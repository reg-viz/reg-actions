//! 比較結果画像を artifact ブランチに push する (`src/push.ts` の Rust 移植)。

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::{anyhow, Context, Result};
use backon::{ExponentialBuilder, Retryable};
use serde::Deserialize;

use crate::compare::CompareOutput;
use crate::constants::{ACTUAL_DIR_NAME, DIFF_DIR_NAME, EXPECTED_DIR_NAME};
use crate::git;
use crate::path::workspace;

#[derive(Debug)]
pub struct PushImagesInput<'a> {
    pub github_token: &'a str,
    pub run_id: u64,
    pub result: &'a CompareOutput,
    pub branch: &'a str,
    pub target_dir: &'a str,
    pub retention_days: u32,
}

#[derive(Debug, Default, Deserialize)]
struct PusherEvent {
    pusher: Option<Pusher>,
}

#[derive(Debug, Default, Deserialize)]
struct Pusher {
    name: Option<String>,
    email: Option<String>,
}

pub async fn push_images(input: PushImagesInput<'_>) -> Result<()> {
    tracing::info!("starting push_images");
    let repo_env =
        std::env::var("GITHUB_REPOSITORY").map_err(|_| anyhow!("GITHUB_REPOSITORY must be set"))?;
    let actor = std::env::var("GITHUB_ACTOR").ok();
    let event_path =
        std::env::var("GITHUB_EVENT_PATH").map_err(|_| anyhow!("GITHUB_EVENT_PATH must be set"))?;
    let event: PusherEvent = serde_json::from_str(
        &fs::read_to_string(&event_path).with_context(|| format!("read {event_path}"))?,
    )
    .unwrap_or_default();

    let pusher = event.pusher.unwrap_or_default();
    let name = pusher
        .name
        .or_else(|| actor.clone())
        .unwrap_or_else(|| "Git Publish Subdirectory".to_string());
    let email = pusher.email.unwrap_or_else(|| {
        actor
            .as_ref()
            .map(|a| format!("{a}@users.noreply.github.com"))
            .unwrap_or_else(|| "nobody@nowhere".to_string())
    });

    git::configure_name(&name)?;
    git::configure_email(&email)?;

    let repo_url = format!(
        "https://x-access-token:{}@github.com/{repo_env}.git",
        input.github_token
    );

    let tmp = make_tmp_dir()?;
    let repo_temp = tmp.join("repo");
    git::clone(&repo_url, &repo_temp)?;

    // fetch (失敗してもブランチが無いだけかもしれないので警告のみ)
    if let Err(e) = git::fetch_origin(input.branch, &repo_temp) {
        let s = e.to_string();
        if !s.contains("Couldn't find remote ref") {
            tracing::warn!(error = %e, "fetch_origin failed");
        }
    }

    let branch_exists = git::has_branch(input.branch, &repo_temp)?;
    if branch_exists {
        git::checkout(input.branch, false, &repo_temp)?;
    } else {
        tracing::info!(branch = input.branch, "creating orphan branch");
        git::checkout(input.branch, true, &repo_temp)?;
        // orphan ブランチでは既存ファイルを全削除 (.git は除く)
        wipe_dir(&repo_temp, &[".git"])?;
    }

    // retention: 古いディレクトリ削除
    let retention = Duration::from_secs(input.retention_days as u64 * 24 * 60 * 60);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO);
    if let Ok(entries) = fs::read_dir(&repo_temp) {
        for entry in entries.flatten() {
            let p = entry.path();
            if !p.is_dir() {
                continue;
            }
            let Some(name) = p.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            let Some(date_str) = name.split('_').next() else {
                continue;
            };
            // YYYY-MM-DD の3区切りだけを対象
            let parts: Vec<&str> = date_str.split('-').collect();
            if parts.len() != 3 {
                continue;
            }
            let Ok(parsed) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") else {
                continue;
            };
            let target = parsed
                .and_hms_opt(0, 0, 0)
                .map(|d| d.and_utc().timestamp())
                .unwrap_or(0) as u64;
            if now.as_secs().saturating_sub(target) > retention.as_secs() {
                tracing::info!(dir = name, "deleting expired dir");
                if let Err(e) = fs::remove_dir_all(&p) {
                    tracing::warn!(error = %e, dir = ?p, "remove_dir_all failed");
                }
            }
        }
    }

    let dest_dir = repo_temp.join(input.target_dir);
    fs::create_dir_all(&dest_dir).context("mkdir dest_dir")?;

    copy_images(input.result, &dest_dir)?;

    git::add_all(&repo_temp)?;
    git::commit(
        &format!(
            "Update {} to output generated at runId:{}",
            input.branch, input.run_id
        ),
        &repo_temp,
    )?;

    let push_branch = input.branch.to_string();
    let backoff = ExponentialBuilder::default()
        .with_max_times(5)
        .with_min_delay(Duration::from_millis(500));
    let cwd = repo_temp.clone();
    (|| async {
        if branch_exists {
            git::rebase(&push_branch, &cwd).context("rebase")?;
        }
        let r = git::push(&push_branch, &cwd).context("push")?;
        if r.code != 0 {
            anyhow::bail!("git push failed: {}", r.stderr.trim());
        }
        tracing::info!(stdout = %r.stdout.trim(), "deployment successful");
        Ok::<(), anyhow::Error>(())
    })
    .retry(backoff)
    .await?;

    Ok(())
}

fn make_tmp_dir() -> Result<PathBuf> {
    let p = std::env::temp_dir().join(format!(
        "reg-actions-{}",
        std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    fs::create_dir_all(&p).context("mkdir tmp")?;
    Ok(p)
}

fn wipe_dir(dir: &Path, keep: &[&str]) -> Result<()> {
    for entry in fs::read_dir(dir)?.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if keep.iter().any(|k| *k == name_str) {
            continue;
        }
        let p = entry.path();
        if p.is_dir() {
            fs::remove_dir_all(&p).with_context(|| format!("rm -rf {}", p.display()))?;
        } else {
            fs::remove_file(&p).with_context(|| format!("rm {}", p.display()))?;
        }
    }
    Ok(())
}

fn copy_images(result: &CompareOutput, dest_root: &Path) -> Result<()> {
    let ws = workspace();

    if !result.deleted_items.is_empty() {
        let dest = dest_root.join("expected");
        fs::create_dir_all(&dest).ok();
        for item in &result.deleted_items {
            let src = ws.join(EXPECTED_DIR_NAME).join(item);
            copy_with_parents(&src, &dest.join(file_name(item)))?;
        }
    }
    if !result.new_items.is_empty() {
        let dest = dest_root.join("actual");
        fs::create_dir_all(&dest).ok();
        for item in &result.new_items {
            let src = ws.join(ACTUAL_DIR_NAME).join(item);
            copy_with_parents(&src, &dest.join(file_name(item)))?;
        }
    }
    if !result.failed_items.is_empty() {
        let diff_dest = dest_root.join("diff");
        let exp_dest = dest_root.join("expected");
        let act_dest = dest_root.join("actual");
        fs::create_dir_all(&diff_dest).ok();
        fs::create_dir_all(&exp_dest).ok();
        fs::create_dir_all(&act_dest).ok();
        for item in &result.failed_items {
            let webp = item_to_webp(item);
            copy_with_parents(
                &ws.join(DIFF_DIR_NAME).join(&webp),
                &diff_dest.join(file_name(&webp)),
            )?;
            copy_with_parents(
                &ws.join(EXPECTED_DIR_NAME).join(item),
                &exp_dest.join(file_name(item)),
            )?;
            copy_with_parents(
                &ws.join(ACTUAL_DIR_NAME).join(item),
                &act_dest.join(file_name(item)),
            )?;
        }
    }
    Ok(())
}

fn file_name(p: &str) -> String {
    Path::new(p)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| p.to_string())
}

fn item_to_webp(p: &str) -> String {
    let path = Path::new(p);
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let parent = path
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
    if parent.is_empty() {
        format!("{stem}.webp")
    } else {
        format!("{parent}/{stem}.webp")
    }
}

fn copy_with_parents(src: &Path, dst: &Path) -> Result<()> {
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).ok();
    }
    if !src.exists() {
        tracing::warn!(src = ?src, "skip missing source file");
        return Ok(());
    }
    fs::copy(src, dst).with_context(|| format!("copy {} -> {}", src.display(), dst.display()))?;
    Ok(())
}
