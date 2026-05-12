//! メインオーケストレーション (`src/service.ts` 移植)。

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

use crate::client::ApiClient;
use crate::comment;
use crate::compare::{self, ComparePaths};
use crate::config::{CommentMode, Config, OutdatedCommentAction};
use crate::constants::{ACTUAL_DIR_NAME, DIFF_DIR_NAME, EXPECTED_DIR_NAME, WORKSPACE_DIR_NAME};
use crate::event::Event;
use crate::helper::target_dir;
use crate::path::workspace;
use crate::push::{push_images, PushImagesInput};
use crate::run::find_run_and_artifact;

pub struct ServiceInput {
    pub event: Event,
    pub run_id: u64,
    pub sha: String,
    pub date: String,
    pub config: Config,
    pub client: ApiClient,
}

pub async fn run(input: ServiceInput) -> Result<()> {
    let ServiceInput {
        event,
        run_id,
        sha,
        date,
        config,
        client,
    } = input;

    init_workspace(&config)?;

    // PR でないイベント (push 等) は upload して終わり。次回比較の expected として使われる。
    let Some(pr_number) = event
        .number
        .or_else(|| event.pull_request.as_ref().map(|p| p.number))
    else {
        tracing::info!("not a pull request event; uploading current images only");
        let _ = compare_and_upload(&client, &config).await?;
        return Ok(());
    };

    let target = find_run_and_artifact(
        &event,
        &client,
        &config.artifact_name,
        config.target_hash.as_deref(),
    )
    .await?;

    let Some(run_and_artifact) = target else {
        tracing::warn!("failed to find target run/artifact; uploading current images");
        let result = compare_and_upload(&client, &config).await?;
        if run_id > 0 {
            let comment = comment::create_comment_without_target(
                &config.artifact_name,
                config.custom_report_page.as_deref(),
                &result.output,
            );
            if config.outdated_comment_action == OutdatedCommentAction::Minimize {
                if let Err(e) = minimize_previous(&client, pr_number, &config.artifact_name).await {
                    tracing::warn!(error = %e, "minimize_previous failed");
                }
            }
            if let Err(e) = client.post_comment(pr_number, &comment).await {
                tracing::warn!(error = %e, "post_comment failed");
            }
        }
        return Ok(());
    };

    let crate::run::RunAndArtifact {
        run: target_run,
        artifact,
    } = run_and_artifact;
    tracing::info!(target_run_id = target_run.id, "found target run");

    download_expected_images(&client, artifact.id).await?;

    let result = compare_and_upload(&client, &config).await?;

    if !config.disable_branch && has_changes(&result.output) {
        push_images(PushImagesInput {
            github_token: &config.github_token,
            run_id,
            result: &result.output,
            branch: &config.branch,
            target_dir: &target_dir(run_id, &config.artifact_name, &date),
            retention_days: config.retention_days,
        })
        .await?;
    }

    let comment_body =
        comment::create_comment_with_target(&comment::CreateCommentWithTargetInput {
            event: &event,
            run_id,
            sha: &sha,
            reg_branch: &config.branch,
            artifact_name: &config.artifact_name,
            target_run_head_sha: &target_run.head_sha,
            result: &result.output,
            date: &date,
            custom_report_page: config.custom_report_page.as_deref(),
            disable_branch: config.disable_branch,
            comment_report_format: config.comment_report_format,
            artifact_id: result.artifact_id,
        });

    let should_post = match config.comment_mode {
        CommentMode::Always => true,
        CommentMode::Changes => has_changes(&result.output),
        CommentMode::Never => false,
    };

    if let Err(e) = handle_comment(
        &client,
        &config,
        pr_number,
        &comment_body,
        &result.output,
        should_post,
    )
    .await
    {
        tracing::warn!(error = %e, "comment handling failed");
    }

    Ok(())
}

struct CompareUploadResult {
    output: crate::compare::CompareOutput,
    artifact_id: Option<u64>,
}

fn init_workspace(config: &Config) -> Result<()> {
    let ws = workspace();
    if ws.exists() {
        fs::remove_dir_all(&ws).with_context(|| format!("rm -rf {}", ws.display()))?;
    }
    fs::create_dir_all(&ws).with_context(|| format!("mkdir -p {}", ws.display()))?;
    let actual = ws.join(ACTUAL_DIR_NAME);
    fs::create_dir_all(&actual).context("mkdir actual")?;
    fs::create_dir_all(ws.join(EXPECTED_DIR_NAME)).context("mkdir expected")?;
    fs::create_dir_all(ws.join(DIFF_DIR_NAME)).context("mkdir diff")?;

    copy_actual_images(&config.image_directory_path, &actual)?;
    Ok(())
}

fn is_image_ext(p: &Path) -> bool {
    matches!(
        p.extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_ascii_lowercase())
            .as_deref(),
        Some("png" | "jpg" | "jpeg" | "tiff" | "bmp" | "gif" | "webp")
    )
}

fn copy_actual_images(src: &Path, dst: &Path) -> Result<()> {
    fn walk(dir: &Path, base: &Path, dst: &Path) -> Result<()> {
        for entry in fs::read_dir(dir)?.flatten() {
            let p = entry.path();
            if p.is_dir() {
                walk(&p, base, dst)?;
            } else if is_image_ext(&p) {
                let rel = p.strip_prefix(base).unwrap_or(&p);
                let target = dst.join(rel);
                if let Some(parent) = target.parent() {
                    fs::create_dir_all(parent).ok();
                }
                fs::copy(&p, &target)
                    .with_context(|| format!("copy {} -> {}", p.display(), target.display()))?;
            }
        }
        Ok(())
    }
    if !src.exists() {
        anyhow::bail!("image source dir not found: {}", src.display());
    }
    walk(src, src, dst)
}

async fn compare_and_upload(client: &ApiClient, config: &Config) -> Result<CompareUploadResult> {
    let ws = workspace();
    let paths = ComparePaths {
        actual: ws.join(ACTUAL_DIR_NAME),
        expected: ws.join(EXPECTED_DIR_NAME),
        diff: ws.join(DIFF_DIR_NAME),
        report_dir: ws.clone(),
    };
    let output = compare::compare(config, paths).await?;
    tracing::info!(
        passed = output.passed_items.len(),
        failed = output.failed_items.len(),
        new = output.new_items.len(),
        deleted = output.deleted_items.len(),
        "compare result"
    );

    let files = collect_files(&ws);
    let upload = client
        .artifact
        .upload_artifact(&config.artifact_name, &files, &ws)
        .await;
    let artifact_id = match upload {
        Ok(r) => {
            tracing::info!(id = ?r.id, size = r.size, "uploaded artifact");
            r.id
        }
        Err(e) => {
            tracing::warn!(error = %e, "upload_artifact failed (non-fatal)");
            None
        }
    };

    Ok(CompareUploadResult {
        output,
        artifact_id,
    })
}

fn collect_files(root: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
        let Ok(rd) = fs::read_dir(dir) else { return };
        for entry in rd.flatten() {
            let p = entry.path();
            if p.is_dir() {
                walk(&p, out);
            } else {
                out.push(p);
            }
        }
    }
    walk(root, &mut out);
    out
}

async fn download_expected_images(client: &ApiClient, artifact_id: u64) -> Result<()> {
    tracing::info!(artifact_id, "downloading expected images");
    let bytes = match client.download_artifact_zip(artifact_id).await {
        Ok(b) => b,
        Err(e) => {
            tracing::error!(error = %e, "download_artifact_zip failed");
            return Ok(());
        }
    };
    tracing::info!(size = bytes.len(), "downloaded zip");

    let cursor = std::io::Cursor::new(bytes.to_vec());
    let mut zip = match zip::ZipArchive::new(cursor) {
        Ok(z) => z,
        Err(e) => {
            tracing::error!(error = %e, "open zip failed");
            return Ok(());
        }
    };
    let ws = workspace();
    for i in 0..zip.len() {
        let mut file = zip.by_index(i)?;
        if file.is_dir() {
            continue;
        }
        let raw = file.name().to_string();
        if !raw.starts_with(&format!("{ACTUAL_DIR_NAME}/")) {
            continue;
        }
        // パストラバーサル防止 (CodeQL #2 対策と同等)
        if raw.contains("..") {
            continue;
        }
        let rewritten = raw.replacen(ACTUAL_DIR_NAME, EXPECTED_DIR_NAME, 1);
        let target = ws.join(&rewritten);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).ok();
        }
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;
        fs::write(&target, &buf).with_context(|| format!("write {}", target.display()))?;
    }
    Ok(())
}

fn has_changes(r: &crate::compare::CompareOutput) -> bool {
    !r.failed_items.is_empty() || !r.new_items.is_empty() || !r.deleted_items.is_empty()
}

async fn minimize_previous(client: &ApiClient, pr: u64, artifact_name: &str) -> Result<()> {
    let comments = client.list_comments(pr).await?;
    for c in comments {
        if let Some(body) = c.body.as_deref() {
            if comment::is_reg_action_comment(artifact_name, body) {
                client.minimize_outdated_comment(&c.node_id).await?;
            }
        }
    }
    Ok(())
}

async fn find_existing(
    client: &ApiClient,
    pr: u64,
    artifact_name: &str,
) -> Result<Option<crate::client::IssueComment>> {
    let comments = client.list_comments(pr).await?;
    Ok(comments.into_iter().find(|c| {
        c.body
            .as_deref()
            .map(|b| comment::is_reg_action_comment(artifact_name, b))
            .unwrap_or(false)
    }))
}

async fn handle_comment(
    client: &ApiClient,
    config: &Config,
    pr_number: u64,
    body: &str,
    result: &crate::compare::CompareOutput,
    should_post_new: bool,
) -> Result<()> {
    let changed = has_changes(result);

    match config.outdated_comment_action {
        OutdatedCommentAction::Update => {
            let existing = find_existing(client, pr_number, &config.artifact_name).await?;
            if changed {
                if let Some(c) = &existing {
                    tracing::info!("updating existing comment with changes");
                    client.update_comment(c.id, body).await?;
                } else if should_post_new {
                    tracing::info!("creating new comment with changes");
                    client.post_comment(pr_number, body).await?;
                } else {
                    tracing::info!("skipping new comment");
                }
                let _ = client.write_summary(body);
            } else if let Some(c) = existing {
                tracing::info!("updating existing comment to resolved");
                let resolved = comment::create_resolved_comment(&config.artifact_name);
                client.update_comment(c.id, &resolved).await?;
                let _ = client.write_summary(&resolved);
            } else if should_post_new {
                client.post_comment(pr_number, body).await?;
                let _ = client.write_summary(body);
            }
        }
        action => {
            if should_post_new {
                if action == OutdatedCommentAction::Minimize {
                    if let Err(e) =
                        minimize_previous(client, pr_number, &config.artifact_name).await
                    {
                        tracing::warn!(error = %e, "minimize_previous failed");
                    }
                }
                client.post_comment(pr_number, body).await?;
                let _ = client.write_summary(body);
            }
        }
    }
    Ok(())
}

#[allow(dead_code)]
fn _unused_marker() -> &'static str {
    WORKSPACE_DIR_NAME
}
