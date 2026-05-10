use anyhow::{anyhow, Context, Result};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Event {
    pub before: Option<String>,
    pub after: Option<String>,
    pub number: Option<u64>,
    #[serde(default)]
    pub pull_request: Option<PullRequest>,
    #[serde(default)]
    pub repository: Option<MinimalRepository>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PullRequest {
    pub number: u64,
    pub head: GitRef,
    pub base: GitRef,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GitRef {
    pub sha: String,
    #[serde(rename = "ref")]
    pub ref_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MinimalRepository {
    pub name: Option<String>,
    pub full_name: Option<String>,
    pub default_branch: Option<String>,
}

pub fn get_event() -> Result<Event> {
    let path = std::env::var("GITHUB_EVENT_PATH")
        .map_err(|_| anyhow!("Failed to get github event.json. GITHUB_EVENT_PATH is not set."))?;
    let raw = std::fs::read_to_string(&path)
        .with_context(|| format!("Failed to read event.json at {path}"))?;
    let event: Event = serde_json::from_str(&raw)
        .with_context(|| format!("Failed to parse event.json at {path}"))?;
    tracing::debug!(?event, "github event");
    Ok(event)
}
