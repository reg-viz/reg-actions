//! `git` CLI ラッパ。サブプロセス実行で済ませる (gix への移行は将来)。

use std::path::Path;
use std::process::{Command, Stdio};

use anyhow::{anyhow, Context, Result};

#[derive(Debug)]
pub struct ExecResult {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
}

pub fn capture<I, S, P>(args: I, cwd: Option<&P>) -> Result<ExecResult>
where
    I: IntoIterator<Item = S>,
    S: AsRef<std::ffi::OsStr>,
    P: AsRef<Path>,
{
    let mut cmd = Command::new("git");
    cmd.args(args);
    if let Some(d) = cwd {
        cmd.current_dir(d);
    }
    let out = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .context("failed to spawn `git`")?;
    Ok(ExecResult {
        stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
        code: out.status.code().unwrap_or(-1),
    })
}

fn ensure_ok(r: &ExecResult, hint: &str) -> Result<()> {
    if r.code != 0 {
        return Err(anyhow!(
            "git {hint} failed (code={}): stderr={}",
            r.code,
            r.stderr.trim()
        ));
    }
    Ok(())
}

/// PR の base..head の merge-base を求める。
pub fn find_target_hash(base_sha: &str, head_sha: &str) -> Result<String> {
    tracing::info!(base = base_sha, head = head_sha, "find merge-base");
    let _ = capture::<_, _, &Path>(
        [
            "config",
            "remote.origin.fetch",
            "+refs/heads/*:refs/remotes/origin/*",
        ],
        None,
    )?;
    let _ = capture::<_, _, &Path>(["fetch", "--all"], None)?;
    let r = capture::<_, _, &Path>(["merge-base", "-a", base_sha, head_sha], None)?;
    ensure_ok(&r, "merge-base")?;
    Ok(r.stdout.trim().to_string())
}

pub fn configure_name(name: &str) -> Result<()> {
    let r = capture::<_, _, &Path>(["config", "--global", "user.name", name], None)?;
    ensure_ok(&r, "config user.name")
}

pub fn configure_email(email: &str) -> Result<()> {
    let r = capture::<_, _, &Path>(["config", "--global", "user.email", email], None)?;
    ensure_ok(&r, "config user.email")
}

pub fn clone(repo_url: &str, dest: &Path) -> Result<()> {
    let r = capture::<_, _, &Path>(["clone", repo_url, &dest.to_string_lossy()], None)?;
    ensure_ok(&r, "clone")
}

pub fn fetch_origin(branch: &str, cwd: &Path) -> Result<ExecResult> {
    capture(
        ["fetch", "-u", "origin", &format!("{branch}:{branch}")],
        Some(&cwd),
    )
}

pub fn has_branch(branch: &str, cwd: &Path) -> Result<bool> {
    let r = capture(["branch", "--list", branch], Some(&cwd))?;
    Ok(!r.stdout.trim().is_empty())
}

pub fn checkout(branch: &str, orphan: bool, cwd: &Path) -> Result<()> {
    let r = if orphan {
        capture(["checkout", "--orphan", branch], Some(&cwd))?
    } else {
        capture(["checkout", branch], Some(&cwd))?
    };
    ensure_ok(&r, "checkout")
}

pub fn add_all(cwd: &Path) -> Result<()> {
    let r = capture(["add", "-A", "."], Some(&cwd))?;
    ensure_ok(&r, "add")
}

pub fn commit(message: &str, cwd: &Path) -> Result<()> {
    let r = capture(["commit", "-m", message], Some(&cwd))?;
    ensure_ok(&r, "commit")
}

pub fn push(branch: &str, cwd: &Path) -> Result<ExecResult> {
    capture(["push", "origin", branch], Some(&cwd))
}

pub fn rebase(branch: &str, cwd: &Path) -> Result<ExecResult> {
    capture(["rebase", &format!("origin/{branch}")], Some(&cwd))
}
