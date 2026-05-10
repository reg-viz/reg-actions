use std::path::PathBuf;

use crate::constants::WORKSPACE_DIR_NAME;

pub fn workspace() -> PathBuf {
    let base = std::env::var("GITHUB_WORKSPACE").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(base).join(WORKSPACE_DIR_NAME)
}
