#[derive(Debug, Clone)]
pub struct Repository {
    pub owner: String,
    pub repo: String,
}

impl Repository {
    /// Parses GITHUB_REPOSITORY ("owner/repo") env var.
    pub fn from_env() -> anyhow::Result<Self> {
        let raw = std::env::var("GITHUB_REPOSITORY")
            .map_err(|_| anyhow::anyhow!("GITHUB_REPOSITORY env var is not set"))?;
        let (owner, repo) = raw.split_once('/').ok_or_else(|| {
            anyhow::anyhow!("GITHUB_REPOSITORY must be 'owner/repo', got '{raw}'")
        })?;
        Ok(Self {
            owner: owner.to_string(),
            repo: repo.to_string(),
        })
    }
}
