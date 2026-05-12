//! GitHub REST/GraphQL クライアントと Actions Artifact v4 ラッパ。
//!
//! - REST/GraphQL は `octocrab` を使う。
//! - Artifact v4 はまだ公式 Rust SDK が無いので、`actions/toolkit` の
//!   実装に倣って Twirl JSON over HTTP を `reqwest` で叩く。
//!   - エンドポイント: `$ACTIONS_RESULTS_URL`
//!   - 認証: `Authorization: Bearer $ACTIONS_RUNTIME_TOKEN`
//!   - サービス: `github.actions.results.api.v1.ArtifactService` の
//!     `CreateArtifact`, `FinalizeArtifact`, `GetSignedArtifactURL`,
//!     `ListArtifacts`

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use backon::{ExponentialBuilder, Retryable};
use bytes::Bytes;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::repository::Repository;

#[derive(Debug, Clone)]
pub struct WorkflowRun {
    pub id: u64,
    pub head_sha: String,
}

#[derive(Debug, Clone)]
pub struct Artifact {
    pub id: u64,
    pub name: String,
}

pub struct ApiClient {
    pub repository: Repository,
    pub octocrab: Arc<octocrab::Octocrab>,
    pub http: Client,
    pub artifact: ArtifactClient,
}

impl ApiClient {
    pub fn new(repository: Repository, github_token: String) -> Result<Self> {
        let octocrab = Arc::new(
            octocrab::OctocrabBuilder::new()
                .personal_token(github_token)
                .build()
                .context("build octocrab")?,
        );
        let http = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .context("build reqwest client")?;
        let artifact = ArtifactClient::from_env(http.clone())?;
        Ok(Self {
            repository,
            octocrab,
            http,
            artifact,
        })
    }

    fn backoff() -> ExponentialBuilder {
        ExponentialBuilder::default()
            .with_max_times(5)
            .with_min_delay(Duration::from_millis(500))
            .with_max_delay(Duration::from_secs(15))
    }

    pub async fn fetch_runs(&self, page: u32, per_page: u32) -> Result<Vec<WorkflowRun>> {
        let octo = self.octocrab.clone();
        let owner = self.repository.owner.clone();
        let repo = self.repository.repo.clone();
        let res: Value = (|| async {
            octo.get::<Value, _, _>(
                format!("/repos/{owner}/{repo}/actions/runs"),
                Some(&[
                    ("per_page", per_page.to_string()),
                    ("page", page.to_string()),
                ]),
            )
            .await
        })
        .retry(Self::backoff())
        .await
        .context("listWorkflowRunsForRepo")?;
        let runs = res
            .get("workflow_runs")
            .and_then(|v| v.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|r| {
                        Some(WorkflowRun {
                            id: r.get("id")?.as_u64()?,
                            head_sha: r.get("head_sha")?.as_str()?.to_string(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();
        Ok(runs)
    }

    pub async fn fetch_artifacts(&self, run_id: u64) -> Result<Vec<Artifact>> {
        let octo = self.octocrab.clone();
        let owner = self.repository.owner.clone();
        let repo = self.repository.repo.clone();
        let res: Value = (|| async {
            octo.get::<Value, _, _>(
                format!("/repos/{owner}/{repo}/actions/runs/{run_id}/artifacts"),
                Some(&[("per_page", "50".to_string())]),
            )
            .await
        })
        .retry(Self::backoff())
        .await
        .context("listWorkflowRunArtifacts")?;
        let arts = res
            .get("artifacts")
            .and_then(|v| v.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|r| {
                        Some(Artifact {
                            id: r.get("id")?.as_u64()?,
                            name: r.get("name")?.as_str()?.to_string(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();
        Ok(arts)
    }

    /// Workflow run artifact を zip でダウンロードする (REST API 経由)。
    ///
    /// `/repos/{}/actions/artifacts/{}/zip` は **302 で Azure Blob 署名 URL
    /// にリダイレクト**する仕様なので、生の `_get` だと空ボディが返って
    /// `Could not find EOCD` で zip パースに失敗する。
    /// octocrab の `actions().download_artifact()` は内部で
    /// `follow_location_to_data` を呼んで本体を取りに行ってくれるので、
    /// そちらを経由する。
    pub async fn download_artifact_zip(&self, artifact_id: u64) -> Result<Bytes> {
        use octocrab::params::actions::ArchiveFormat;
        let owner = self.repository.owner.clone();
        let repo = self.repository.repo.clone();
        let octo = self.octocrab.clone();
        let bytes = (|| async {
            octo.actions()
                .download_artifact(&owner, &repo, artifact_id.into(), ArchiveFormat::Zip)
                .await
        })
        .retry(Self::backoff())
        .await
        .context("downloadArtifact")?;
        Ok(bytes)
    }

    pub async fn list_comments(&self, issue_number: u64) -> Result<Vec<IssueComment>> {
        let owner = self.repository.owner.clone();
        let repo = self.repository.repo.clone();
        let octo = self.octocrab.clone();
        let mut out = Vec::new();
        let mut page: u32 = 1;
        loop {
            let res: Value = (|| async {
                octo.get::<Value, _, _>(
                    format!("/repos/{owner}/{repo}/issues/{issue_number}/comments"),
                    Some(&[("per_page", "100".to_string()), ("page", page.to_string())]),
                )
                .await
            })
            .retry(Self::backoff())
            .await
            .context("listComments")?;
            let arr = match res.as_array() {
                Some(a) => a.clone(),
                None => break,
            };
            if arr.is_empty() {
                break;
            }
            for c in &arr {
                if let (Some(id), Some(node_id)) = (
                    c.get("id").and_then(|v| v.as_u64()),
                    c.get("node_id").and_then(|v| v.as_str()),
                ) {
                    out.push(IssueComment {
                        id,
                        node_id: node_id.to_string(),
                        body: c
                            .get("body")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                    });
                }
            }
            if arr.len() < 100 {
                break;
            }
            page += 1;
        }
        Ok(out)
    }

    pub async fn update_comment(&self, comment_id: u64, body: &str) -> Result<()> {
        let owner = self.repository.owner.clone();
        let repo = self.repository.repo.clone();
        let octo = self.octocrab.clone();
        let body = body.to_string();
        (|| async {
            octo._patch::<Value>(
                format!("/repos/{owner}/{repo}/issues/comments/{comment_id}"),
                Some(&json!({ "body": body })),
            )
            .await
        })
        .retry(Self::backoff())
        .await
        .context("updateComment")?;
        Ok(())
    }

    pub async fn post_comment(&self, issue_number: u64, body: &str) -> Result<()> {
        let owner = self.repository.owner.clone();
        let repo = self.repository.repo.clone();
        let octo = self.octocrab.clone();
        let body = body.to_string();
        (|| async {
            octo._post(
                format!("/repos/{owner}/{repo}/issues/{issue_number}/comments"),
                Some(&json!({ "body": body })),
            )
            .await
        })
        .retry(Self::backoff())
        .await
        .context("postComment")?;
        Ok(())
    }

    pub async fn minimize_outdated_comment(&self, node_id: &str) -> Result<()> {
        let octo = self.octocrab.clone();
        let q = r#"
mutation($input: MinimizeCommentInput!) {
  minimizeComment(input: $input) {
    minimizedComment { isMinimized }
  }
}"#;
        let body = json!({
            "query": q,
            "variables": { "input": { "subjectId": node_id, "classifier": "OUTDATED" } }
        });
        (|| async { octo.graphql::<Value>(&body).await })
            .retry(Self::backoff())
            .await
            .context("minimizeComment")?;
        Ok(())
    }

    /// `$GITHUB_STEP_SUMMARY` に Markdown を append する。
    pub fn write_summary(&self, raw: &str) -> Result<()> {
        let Some(path) = std::env::var_os("GITHUB_STEP_SUMMARY") else {
            tracing::debug!("GITHUB_STEP_SUMMARY not set; skipping summary write");
            return Ok(());
        };
        use std::io::Write as _;
        let mut f = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .with_context(|| format!("open {}", PathBuf::from(&path).display()))?;
        f.write_all(raw.as_bytes()).context("write summary")?;
        f.write_all(b"\n").ok();
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct IssueComment {
    pub id: u64,
    pub node_id: String,
    pub body: Option<String>,
}

// =============================================================================
// Actions Artifact v4 client
// =============================================================================

/// Actions Runtime が GHA ランナーに渡す環境変数:
/// - `ACTIONS_RUNTIME_TOKEN`: bearer token
/// - `ACTIONS_RESULTS_URL`: e.g. `https://results-receiver.actions.githubusercontent.com/`
/// - `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`: workflow run identifiers
pub struct ArtifactClient {
    http: Client,
    base_url: String,
    token: String,
    workflow_run_backend_id: String,
    workflow_job_run_backend_id: String,
}

impl ArtifactClient {
    pub fn from_env(http: Client) -> Result<Self> {
        // ランナー上でのみ利用可能。ローカル開発時には None になり、関連 API は使用不可。
        let token = std::env::var("ACTIONS_RUNTIME_TOKEN").unwrap_or_default();
        let base_url = std::env::var("ACTIONS_RESULTS_URL").unwrap_or_default();
        // `runtime_token` から backend ID を抽出するのが本筋だが、
        // 暫定的に GITHUB_RUN_ID / GITHUB_RUN_ATTEMPT を使う実装にしておく。
        // (Twirl 側の actual ID 抽出は JWT デコードが必要 → 別タスク)
        let workflow_run_backend_id = std::env::var("GITHUB_RUN_ID").unwrap_or_default();
        let workflow_job_run_backend_id = std::env::var("GITHUB_RUN_ATTEMPT").unwrap_or_default();
        Ok(Self {
            http,
            base_url,
            token,
            workflow_run_backend_id,
            workflow_job_run_backend_id,
        })
    }

    fn enabled(&self) -> bool {
        !self.token.is_empty() && !self.base_url.is_empty()
    }

    fn twirl_headers(&self) -> Result<HeaderMap> {
        let mut h = HeaderMap::new();
        h.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", self.token))?,
        );
        h.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        Ok(h)
    }

    fn endpoint(&self, method: &str) -> String {
        let base = self.base_url.trim_end_matches('/');
        format!("{base}/twirl/github.actions.results.api.v1.ArtifactService/{method}")
    }

    /// Artifact をアップロードする。
    /// `files` のうち `workspace_root` 配下にあるものだけをアーカイブし、相対パスで保存。
    ///
    /// **既知の制約 (2026-05 時点):** Artifact v4 の Twirl API は
    /// `ACTIONS_RUNTIME_TOKEN` / `ACTIONS_RESULTS_URL` を要求するが、
    /// これらは **composite action のシェルステップには runner が注入しない**
    /// (GitHub のセキュリティ仕様)。Node20 action からは process env で
    /// 見えるが、composite からは見えない。
    ///
    /// 当面は env 変数が無いときに `Ok(skipped)` を返してアップロードを
    /// no-op 扱いとする。次回比較のための expected 画像保存は、別ルート
    /// (reg_actions branch への push) でカバーされる前提。
    pub async fn upload_artifact(
        &self,
        artifact_name: &str,
        files: &[PathBuf],
        workspace_root: &Path,
    ) -> Result<UploadArtifactResult> {
        if !self.enabled() {
            tracing::warn!(
                "skipping artifact upload — ACTIONS_RUNTIME_TOKEN / ACTIONS_RESULTS_URL not \
                 available to this composite step. The branch-based image storage \
                 (`disable-branch: false`) still works; only the artifact-as-cache path is \
                 affected. Tracking: https://github.com/actions/runner/issues/2391",
            );
            return Ok(UploadArtifactResult { id: None, size: 0 });
        }

        // 1. zip を作る
        let zip_bytes = build_zip(files, workspace_root)?;
        let size = zip_bytes.len() as u64;

        // 2. CreateArtifact → signed URL
        let create_body = json!({
            "workflow_run_backend_id": self.workflow_run_backend_id,
            "workflow_job_run_backend_id": self.workflow_job_run_backend_id,
            "name": artifact_name,
            "version": 4,
        });
        let create_res: Value = self
            .http
            .post(self.endpoint("CreateArtifact"))
            .headers(self.twirl_headers()?)
            .json(&create_body)
            .send()
            .await
            .context("CreateArtifact send")?
            .error_for_status()
            .context("CreateArtifact status")?
            .json()
            .await
            .context("CreateArtifact json")?;
        let signed_url = create_res
            .get("signed_upload_url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("CreateArtifact: no signed_upload_url in response"))?
            .to_string();

        // 3. Azure Blob 単発 PUT (大きいファイルは block upload に分けるべきだが PoC では一括)
        self.http
            .put(&signed_url)
            .header("x-ms-blob-type", "BlockBlob")
            .header("x-ms-version", "2020-04-08")
            .body(zip_bytes.clone())
            .send()
            .await
            .context("Azure PUT send")?
            .error_for_status()
            .context("Azure PUT status")?;

        // 4. SHA256
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(&zip_bytes);
        let hash = hex::encode(hasher.finalize());

        // 5. FinalizeArtifact
        let finalize_body = json!({
            "workflow_run_backend_id": self.workflow_run_backend_id,
            "workflow_job_run_backend_id": self.workflow_job_run_backend_id,
            "name": artifact_name,
            "size": size,
            "hash": format!("sha256:{hash}"),
        });
        let finalize_res: Value = self
            .http
            .post(self.endpoint("FinalizeArtifact"))
            .headers(self.twirl_headers()?)
            .json(&finalize_body)
            .send()
            .await
            .context("FinalizeArtifact send")?
            .error_for_status()
            .context("FinalizeArtifact status")?
            .json()
            .await
            .context("FinalizeArtifact json")?;
        let id = finalize_res.get("artifact_id").and_then(|v| {
            v.as_str()
                .and_then(|s| s.parse::<u64>().ok())
                .or_else(|| v.as_u64())
        });

        Ok(UploadArtifactResult { id, size })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadArtifactResult {
    pub id: Option<u64>,
    pub size: u64,
}

/// `files` を `workspace_root` 相対パスで zip にまとめてメモリ上に返す。
fn build_zip(files: &[PathBuf], workspace_root: &Path) -> Result<Vec<u8>> {
    use std::io::{Cursor, Read};
    use zip::write::SimpleFileOptions;
    use zip::CompressionMethod;

    let buf = Cursor::new(Vec::<u8>::new());
    let mut zw = zip::ZipWriter::new(buf);
    let opts: SimpleFileOptions = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);
    for f in files {
        if !f.is_file() {
            continue;
        }
        let rel = f
            .strip_prefix(workspace_root)
            .unwrap_or(f)
            .to_string_lossy()
            .into_owned();
        zw.start_file(rel, opts).context("zip start_file")?;
        let mut input = std::fs::File::open(f).with_context(|| format!("open {}", f.display()))?;
        let mut buf = Vec::new();
        input.read_to_end(&mut buf).context("read file")?;
        use std::io::Write as _;
        zw.write_all(&buf).context("zip write_all")?;
    }
    let cur = zw.finish().context("zip finish")?;
    Ok(cur.into_inner())
}

// HeaderName は現状未使用だが将来の x-ms-* ヘッダ拡張のため import を保持。
#[allow(dead_code)]
fn _unused_marker_for_header_name() -> Option<HeaderName> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn artifact_disabled_without_env() {
        // ACTIONS_RUNTIME_TOKEN/RESULTS_URL が無いと enabled() == false。
        // 並行で他テストが env をいじる可能性があるので一時的にクリア。
        let prev_t = std::env::var("ACTIONS_RUNTIME_TOKEN").ok();
        let prev_u = std::env::var("ACTIONS_RESULTS_URL").ok();
        std::env::remove_var("ACTIONS_RUNTIME_TOKEN");
        std::env::remove_var("ACTIONS_RESULTS_URL");
        let http = Client::new();
        let c = ArtifactClient::from_env(http).unwrap();
        assert!(!c.enabled());
        if let Some(v) = prev_t {
            std::env::set_var("ACTIONS_RUNTIME_TOKEN", v);
        }
        if let Some(v) = prev_u {
            std::env::set_var("ACTIONS_RESULTS_URL", v);
        }
    }

    #[test]
    fn artifact_endpoint_format() {
        let http = Client::new();
        let mut c = ArtifactClient::from_env(http).unwrap();
        c.base_url = "https://results.example.com".to_string();
        let ep = c.endpoint("CreateArtifact");
        assert_eq!(
            ep,
            "https://results.example.com/twirl/github.actions.results.api.v1.ArtifactService/CreateArtifact"
        );
        // trailing slash も吸収する
        c.base_url = "https://results.example.com/".to_string();
        let ep2 = c.endpoint("FinalizeArtifact");
        assert!(ep2.ends_with("/FinalizeArtifact"));
        assert!(!ep2.contains("//twirl"));
    }

    #[test]
    fn build_zip_roundtrip() {
        let tmp = std::env::temp_dir().join("reg_actions_zip_test");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(tmp.join("sub")).unwrap();
        std::fs::write(tmp.join("a.txt"), b"hello").unwrap();
        std::fs::write(tmp.join("sub/b.txt"), b"world").unwrap();

        let files = vec![tmp.join("a.txt"), tmp.join("sub/b.txt")];
        let bytes = build_zip(&files, &tmp).unwrap();
        assert!(!bytes.is_empty());

        // round-trip via zip reader
        let cur = std::io::Cursor::new(bytes);
        let mut z = zip::ZipArchive::new(cur).unwrap();
        let names: Vec<String> = (0..z.len())
            .map(|i| z.by_index(i).unwrap().name().to_string())
            .collect();
        assert!(names.contains(&"a.txt".to_string()));
        assert!(names.iter().any(|n| n == "sub/b.txt" || n == "sub\\b.txt"));

        let mut buf = String::new();
        z.by_name("a.txt")
            .unwrap()
            .read_to_string(&mut buf)
            .unwrap();
        assert_eq!(buf, "hello");
    }

    #[test]
    fn twirl_headers_set_bearer() {
        let http = Client::new();
        let mut c = ArtifactClient::from_env(http).unwrap();
        c.token = "abc123".to_string();
        let h = c.twirl_headers().unwrap();
        assert_eq!(h.get(AUTHORIZATION).unwrap(), "Bearer abc123");
        assert_eq!(h.get(CONTENT_TYPE).unwrap(), "application/json");
    }
}
