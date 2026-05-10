//! `findRunAndArtifact`: PR の merge-base SHA に一致する過去 workflow run を
//! ページネーションで探し、対象 artifact を返す。

use anyhow::Result;

use crate::client::{ApiClient, Artifact, WorkflowRun};
use crate::event::Event;
use crate::git;

const PAGE_LIMIT: u32 = 200;
const PER_PAGE: u32 = 50;

#[derive(Debug, Clone)]
pub struct RunAndArtifact {
    pub run: WorkflowRun,
    pub artifact: Artifact,
}

pub async fn find_run_and_artifact(
    event: &Event,
    client: &ApiClient,
    artifact_name: &str,
    target_hash_input: Option<&str>,
) -> Result<Option<RunAndArtifact>> {
    let Some(pr) = event.pull_request.as_ref() else {
        return Ok(None);
    };

    let target_hash = match target_hash_input {
        Some(s) => s.to_string(),
        None => git::find_target_hash(&pr.base.sha, &pr.head.sha)?,
    };
    let short = target_hash.chars().take(7).collect::<String>();
    tracing::info!(target_hash = %target_hash, "resolved target hash");

    for page in 1..=PAGE_LIMIT {
        tracing::info!(page, "fetching workflow runs");
        let runs = client.fetch_runs(page, PER_PAGE).await?;
        let count = runs.len();
        tracing::info!(count, "received runs");

        for run in runs.iter().filter(|r| r.head_sha.starts_with(&short)) {
            let artifacts = client.fetch_artifacts(run.id).await?;
            if let Some(found) = artifacts.into_iter().find(|a| a.name == artifact_name) {
                return Ok(Some(RunAndArtifact {
                    run: run.clone(),
                    artifact: found,
                }));
            }
        }

        if count < PER_PAGE as usize {
            tracing::info!("no more runs to fetch");
            return Ok(None);
        }
    }
    tracing::warn!(PAGE_LIMIT, "page limit reached");
    Ok(None)
}
