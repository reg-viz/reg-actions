use std::path::{Path, PathBuf};

use anyhow::{anyhow, bail, Context, Result};
use once_cell::sync::Lazy;
use regex::Regex;

use crate::constants::ARTIFACT_NAME;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommentReportFormat {
    Raw,
    Summarized,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutdatedCommentAction {
    None,
    Minimize,
    Update,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommentMode {
    Always,
    Changes,
    Never,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub image_directory_path: PathBuf,
    pub github_token: String,
    pub enable_antialias: bool,
    pub matching_threshold: f64,
    pub threshold_rate: f64,
    pub threshold_pixel: Option<u64>,
    pub target_hash: Option<String>,
    pub artifact_name: String,
    pub branch: String,
    pub disable_branch: bool,
    pub custom_report_page: Option<String>,
    pub report_file_path: PathBuf,
    pub comment_report_format: CommentReportFormat,
    pub outdated_comment_action: OutdatedCommentAction,
    pub retention_days: u32,
    pub comment_mode: CommentMode,
}

/// Reads an INPUT_<name> env var (GitHub Actions sets these from `with:`).
/// `name` uses kebab-case as in action.yml; we convert to UPPER_SNAKE.
fn get_input(name: &str) -> Option<String> {
    let key = format!("INPUT_{}", name.to_ascii_uppercase().replace('-', "_"));
    match std::env::var(&key) {
        Ok(v) => {
            let trimmed = v.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        }
        Err(_) => None,
    }
}

fn get_bool_input(name: &str) -> Result<bool> {
    let Some(v) = get_input(name) else {
        return Ok(false);
    };
    match v.as_str() {
        "true" => Ok(true),
        "false" => Ok(false),
        other => Err(anyhow!(
            "'{}' input must be boolean value 'true' or 'false' but got '{}'",
            name,
            other
        )),
    }
}

fn get_number_input(name: &str) -> Result<Option<f64>> {
    match get_input(name) {
        None => Ok(None),
        Some(v) => v
            .parse::<f64>()
            .map(Some)
            .map_err(|_| anyhow!("'{}' input must be number value but got '{}'", name, v)),
    }
}

static TARGET_HASH_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"[0-9a-f]{5,40}").unwrap());
static URL_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(?:https?://)[\w.-]+(?:\.[\w.-]+)+[\w\-._~:/?#\[\]@!$&'()*+,;=.]+$").unwrap()
});

impl Config {
    pub fn from_env() -> Result<Self> {
        let github_token = get_input("github-token")
            .ok_or_else(|| anyhow!("'github-token' is not set. Please give API token."))?;

        let image_directory_path = get_input("image-directory-path").ok_or_else(|| {
            anyhow!("'image-directory-path' is not set. Please specify path to image directory.")
        })?;
        let image_dir = PathBuf::from(&image_directory_path);
        let meta = std::fs::metadata(&image_dir).with_context(|| {
            format!("'image-directory-path' is not directory. Please specify path to image directory. (path={image_directory_path})")
        })?;
        if !meta.is_dir() {
            bail!(
                "'image-directory-path' is not directory. Please specify path to image directory."
            );
        }

        let matching_threshold = get_number_input("matching-threshold")?.unwrap_or(0.0);
        let threshold_rate = get_number_input("threshold-rate")?.unwrap_or(0.0);
        let threshold_pixel = get_number_input("threshold-pixel")?.map(|n| n as u64);
        let retention_days = get_number_input("retention-days")?.unwrap_or(30.0) as u32;

        if !(0.0..=1.0).contains(&matching_threshold) {
            bail!("'matching-threshold' input must be 0 to 1 '{matching_threshold}'");
        }
        if !(0.0..=1.0).contains(&threshold_rate) {
            bail!("'threshold-rate' input must be 0 to 1 '{threshold_rate}'");
        }

        let target_hash = get_input("target-hash");
        if let Some(h) = &target_hash {
            if !TARGET_HASH_RE.is_match(h) {
                bail!("'target-hash' input must be commit hash but got '{h}'");
            }
        }

        let artifact_name = get_input("artifact-name").unwrap_or_else(|| ARTIFACT_NAME.to_string());
        let branch = get_input("branch").unwrap_or_else(|| "reg_actions".to_string());

        let custom_report_page = get_input("custom-report-page");
        if let Some(link) = &custom_report_page {
            if !URL_RE.is_match(link) {
                bail!("'custom-report-page' input must be a valid url '{link}'");
            }
        }

        let mut report_file_path =
            get_input("report-file-path").unwrap_or_else(|| "./report.html".to_string());
        if let Ok(meta) = std::fs::metadata(&report_file_path) {
            if meta.is_dir() {
                report_file_path = Path::new(&report_file_path)
                    .join("report.html")
                    .to_string_lossy()
                    .into_owned();
            }
        }

        let comment_report_format = match get_input("comment-report-format")
            .as_deref()
            .unwrap_or("raw")
        {
            "raw" => CommentReportFormat::Raw,
            "summarized" => CommentReportFormat::Summarized,
            other => bail!(
                "'comment-report-format' input must be 'raw' or 'summarized' but got '{other}'"
            ),
        };

        let outdated_comment_action = match get_input("outdated-comment-action")
            .as_deref()
            .unwrap_or("none")
        {
            "none" => OutdatedCommentAction::None,
            "minimize" => OutdatedCommentAction::Minimize,
            "update" => OutdatedCommentAction::Update,
            other => bail!(
                "'outdated-comment-action' input must be 'none', 'minimize', or 'update' but got '{other}'"
            ),
        };

        let comment_mode = match get_input("comment-mode").as_deref().unwrap_or("always") {
            "always" => CommentMode::Always,
            "changes" => CommentMode::Changes,
            "never" => CommentMode::Never,
            other => {
                bail!("'comment-mode' input must be 'always', 'changes', or 'never' but got '{other}'")
            }
        };

        Ok(Self {
            image_directory_path: image_dir,
            github_token,
            enable_antialias: get_bool_input("enable-antialias")?,
            matching_threshold,
            threshold_rate,
            threshold_pixel,
            target_hash,
            artifact_name,
            branch,
            disable_branch: get_bool_input("disable-branch")?,
            custom_report_page,
            report_file_path: PathBuf::from(report_file_path),
            comment_report_format,
            outdated_comment_action,
            retention_days,
            comment_mode,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn clear_env() {
        for (k, _) in std::env::vars() {
            if k.starts_with("INPUT_") {
                std::env::remove_var(&k);
            }
        }
    }

    #[test]
    fn missing_token_errors() {
        let _g = ENV_LOCK.lock().unwrap();
        clear_env();
        let err = Config::from_env().unwrap_err();
        assert!(err.to_string().contains("github-token"));
    }

    #[test]
    fn missing_image_dir_errors() {
        let _g = ENV_LOCK.lock().unwrap();
        clear_env();
        std::env::set_var("INPUT_GITHUB_TOKEN", "abc");
        let err = Config::from_env().unwrap_err();
        assert!(err.to_string().contains("image-directory-path"));
    }

    #[test]
    fn invalid_threshold_errors() {
        let _g = ENV_LOCK.lock().unwrap();
        clear_env();
        let dir = std::env::temp_dir().join("reg_actions_cfg_test");
        let _ = std::fs::create_dir_all(&dir);
        std::env::set_var("INPUT_GITHUB_TOKEN", "abc");
        std::env::set_var(
            "INPUT_IMAGE_DIRECTORY_PATH",
            dir.to_string_lossy().to_string(),
        );
        std::env::set_var("INPUT_MATCHING_THRESHOLD", "1.5");
        let err = Config::from_env().unwrap_err();
        assert!(err.to_string().contains("matching-threshold"));
    }
}
