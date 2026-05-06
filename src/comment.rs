//! PR コメントの Markdown 生成 (純粋関数)。
//! `src/comment.ts` を機械的に Rust 化した。

use std::path::Path;

use crate::compare::CompareOutput;
use crate::config::CommentReportFormat;
use crate::event::Event;

const MAX_BODY_BYTES: usize = 60 * 1024; // GitHub comment は 64 KiB 上限、6 KiB マージン
const HARD_MAX: usize = 65536;

fn is_success(r: &CompareOutput) -> bool {
    r.failed_items.is_empty() && r.new_items.is_empty() && r.deleted_items.is_empty()
}

fn badge(r: &CompareOutput) -> &'static str {
    if !r.failed_items.is_empty() {
        "![change detected](https://img.shields.io/badge/%E2%9C%94%20reg-change%20detected-orange)"
    } else if !r.new_items.is_empty() {
        "![new items](https://img.shields.io/badge/%E2%9C%94%20reg-new%20items-green)"
    } else {
        "![success](https://img.shields.io/badge/%E2%9C%94%20reg-passed-green)"
    }
}

fn url_encode(s: &str) -> String {
    // 軽量な application/x-www-form-urlencoded ではなく URL component encoding。
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push_str(&format!("%{:02X}", b));
            }
        }
    }
    out
}

fn base_url(
    owner: &str,
    repo: &str,
    branch: &str,
    run_id: u64,
    artifact_name: &str,
    date: &str,
) -> String {
    format!("https://github.com/{owner}/{repo}/blob/{branch}/{date}_{run_id}_{artifact_name}/")
}

fn item_basename(p: &str) -> String {
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

fn render_diff_table(base: &str, base_url: &str, fmt: CommentReportFormat) -> String {
    let filename = url_encode(base);
    let actual = format!("{base_url}actual/{filename}?raw=true");
    let expected = format!("{base_url}expected/{filename}?raw=true");
    let webp = url_encode(&item_to_webp(base));
    let diff = format!("{base_url}diff/{webp}?raw=true");
    let table = format!(
        "
| actual|![Actual]({actual}) |
|--|--|
|expected|![Expected]({expected})|
|difference|![Difference]({diff})|
"
    );
    match fmt {
        CommentReportFormat::Summarized => {
            format!("<details><summary>{base}</summary>\n{table}\n</details>")
        }
        CommentReportFormat::Raw => format!("### `{base}`\n{table}"),
    }
}

fn render_single_table(base: &str, dir: &str, base_url: &str, fmt: CommentReportFormat) -> String {
    let filename = url_encode(base);
    let img = format!("{base_url}{dir}/{filename}?raw=true");
    let table = format!("\n|  |\n|--|\n|![Img]({img})|\n");
    match fmt {
        CommentReportFormat::Summarized => {
            format!("<details><summary>{base}</summary>\n{table}\n</details>")
        }
        CommentReportFormat::Raw => format!("### `{base}`\n{table}"),
    }
}

fn differences_section(r: &CompareOutput, base_url: &str, fmt: CommentReportFormat) -> String {
    if r.failed_items.is_empty() {
        return String::new();
    }
    let body = r
        .failed_items
        .iter()
        .map(|item| render_diff_table(&item_basename(item), base_url, fmt))
        .collect::<Vec<_>>()
        .join("\n");
    format!("   \n     \n### Differences\n  \n{body}\n  ")
}

fn new_items_section(r: &CompareOutput, base_url: &str, fmt: CommentReportFormat) -> String {
    if r.new_items.is_empty() {
        return String::new();
    }
    let body = r
        .new_items
        .iter()
        .map(|item| render_single_table(&item_basename(item), "actual", base_url, fmt))
        .collect::<Vec<_>>()
        .join("\n");
    format!("   \n     \n### New Items\n  \n{body}\n  ")
}

fn deleted_items_section(r: &CompareOutput, base_url: &str, fmt: CommentReportFormat) -> String {
    if r.deleted_items.is_empty() {
        return String::new();
    }
    let body = r
        .deleted_items
        .iter()
        .map(|item| render_single_table(&item_basename(item), "expected", base_url, fmt))
        .collect::<Vec<_>>()
        .join("\n");
    format!("   \n   \n### Deleted Items\n  \n{body}\n  ")
}

#[derive(Debug)]
pub struct CreateCommentWithTargetInput<'a> {
    pub event: &'a Event,
    pub run_id: u64,
    pub sha: &'a str,
    pub reg_branch: &'a str,
    pub artifact_name: &'a str,
    pub target_run_head_sha: &'a str,
    pub result: &'a CompareOutput,
    pub date: &'a str,
    pub custom_report_page: Option<&'a str>,
    pub disable_branch: bool,
    pub comment_report_format: CommentReportFormat,
    pub artifact_id: Option<u64>,
}

pub fn create_comment_with_target(input: &CreateCommentWithTargetInput<'_>) -> String {
    let (owner, repo) = input
        .event
        .repository
        .as_ref()
        .and_then(|r| r.full_name.as_ref())
        .and_then(|f| f.split_once('/'))
        .map(|(o, r)| (o.to_string(), r.to_string()))
        .unwrap_or_default();
    let target_hash = input.target_run_head_sha;
    let current_short = input.sha.chars().take(7).collect::<String>();
    let target_short = target_hash.chars().take(7).collect::<String>();
    let base_url = base_url(
        &owner,
        &repo,
        input.reg_branch,
        input.run_id,
        input.artifact_name,
        input.date,
    );

    let report = if (is_success(input.result)) || input.disable_branch {
        String::new()
    } else {
        format!(
            "   \n<details>\n<summary>📝 Report</summary>\n{}\n{}\n{}\n</details>",
            differences_section(input.result, &base_url, input.comment_report_format),
            new_items_section(input.result, &base_url, input.comment_report_format),
            deleted_items_section(input.result, &base_url, input.comment_report_format),
        )
    };

    let report_url = match input.custom_report_page {
        Some(u) => format!("   \nCheck out the report [here]({u})."),
        None => String::new(),
    };

    let artifact_link = match input.artifact_id {
        Some(id) => format!(
            "[`{}`](https://github.com/{owner}/{repo}/actions/runs/{}/artifacts/{id})",
            input.artifact_name, input.run_id
        ),
        None => format!("`{}`", input.artifact_name),
    };

    let success_or_fail = if is_success(input.result) {
        format!(
            "{badge}\n\n ## ArtifactName: {artifact_link}\n  \n✨✨ That's perfect, there is no visual difference! ✨✨\n{report_url}\n    ",
            badge = badge(input.result),
        )
    } else {
        format!(
            "{badge}\n\n ## ArtifactName: {artifact_link}\n\n{report_url}\n    ",
            badge = badge(input.result),
        )
    };

    let body = format!(
        "This report was generated by comparing [{current_short}](https://github.com/{owner}/{repo}/commit/{sha}) with [{target_short}](https://github.com/{owner}/{repo}/commit/{target_hash}).\nIf you would like to check difference, please check [here](https://github.com/{owner}/{repo}/compare/{target_short}..{current_short}).\n  \n{success_or_fail}\n  \n| item    | count                         |\n|:--------|:-----------------------------:|\n| pass    | {pass}  |\n| change  | {change}  |\n| new     | {new}     |\n| delete  | {delete} |\n{report}\n",
        sha = input.sha,
        pass = input.result.passed_items.len(),
        change = input.result.failed_items.len(),
        new = input.result.new_items.len(),
        delete = input.result.deleted_items.len(),
    );

    if body.len() > MAX_BODY_BYTES {
        let mut lines: Vec<&str> = body.split('\n').collect();
        while lines.join("\n").len() > MAX_BODY_BYTES && !lines.is_empty() {
            lines.pop();
        }
        let mut out = lines.join("\n");
        out.push('\n');
        out.push_str(
            "\n⚠️ report is omitted because comment body size limitation exceeded. Please check report in artifact.",
        );
        out
    } else {
        body
    }
}

pub fn create_comment_without_target(
    artifact_name: &str,
    custom_report_page: Option<&str>,
    result: &CompareOutput,
) -> String {
    let report = match custom_report_page {
        Some(u) => format!("   \n  Check out the report [here]({u})."),
        None => String::new(),
    };
    let body = format!(
        "## ArtifactName: `{artifact_name}`\n  \nFailed to find a target artifact.\nAll items will be treated as new items and will be used as expected data for the next time.\n\n![target not found](https://img.shields.io/badge/%E2%9C%94%20reg-new%20items-blue)\n{report}\n\n| item    | count                         |\n|:--------|:-----------------------------:|\n| new     | {new}     |\n  ",
        new = result.new_items.len(),
    );
    if body.len() > HARD_MAX {
        body[..HARD_MAX].to_string()
    } else {
        body
    }
}

pub fn is_reg_action_comment(artifact_name: &str, body: &str) -> bool {
    body.contains(&format!("## ArtifactName: `{artifact_name}`"))
        || body.contains(&format!("## ArtifactName: [`{artifact_name}`]"))
}

pub fn create_resolved_comment(artifact_name: &str) -> String {
    format!(
        "![resolved](https://img.shields.io/badge/%E2%9C%94%20reg-resolved-green)\n\n## ArtifactName: `{artifact_name}`\n\n✨ All visual differences have been resolved! ✨\n",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_result() -> CompareOutput {
        CompareOutput::default()
    }

    #[test]
    fn url_encode_handles_unicode() {
        assert_eq!(url_encode("hello world"), "hello%20world");
        assert_eq!(url_encode("foo.png"), "foo.png");
    }

    #[test]
    fn item_to_webp_strips_extension() {
        assert_eq!(item_to_webp("a.png"), "a.webp");
        assert_eq!(item_to_webp("sub/b.jpg"), "sub/b.webp");
    }

    #[test]
    fn is_reg_action_comment_matches_both_forms() {
        assert!(is_reg_action_comment("reg", "## ArtifactName: `reg`"));
        assert!(is_reg_action_comment(
            "reg",
            "## ArtifactName: [`reg`](https://...)"
        ));
        assert!(!is_reg_action_comment("reg", "unrelated"));
    }

    #[test]
    fn without_target_includes_new_count() {
        let mut r = empty_result();
        r.new_items.push("a.png".into());
        let body = create_comment_without_target("reg", None, &r);
        assert!(body.contains("| new     | 1"));
        assert!(body.contains("ArtifactName: `reg`"));
    }

    #[test]
    fn resolved_comment_format() {
        let s = create_resolved_comment("reg");
        assert!(s.contains("ArtifactName: `reg`"));
        assert!(s.contains("resolved"));
    }
}
