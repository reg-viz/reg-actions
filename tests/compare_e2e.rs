//! reg.wasm を wasmtime で走らせる end-to-end テスト。
//!
//! - 同一画像 vs 同一画像 → passed_items に 1 件
//! - 画像 vs (存在しない) → new_items に 1 件
//!
//! `vendor/reg.wasm` (リポジトリ同梱) を使う。

use std::fs;
use std::path::PathBuf;

use reg_actions::compare::{run_compare, CompareInput};

fn fixture_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn make_tmp(name: &str) -> PathBuf {
    let p = std::env::temp_dir()
        .join("reg_actions_e2e")
        .join(format!("{name}_{}", std::process::id()));
    let _ = fs::remove_dir_all(&p);
    fs::create_dir_all(&p).unwrap();
    p
}

#[test]
fn same_image_against_itself_is_passed() {
    let actual = make_tmp("actual_same");
    let expected = make_tmp("expected_same");
    let diff = make_tmp("diff_same");
    let report = make_tmp("report_same");

    let src = fixture_dir().join("images/sample.png");
    fs::copy(&src, actual.join("sample.png")).unwrap();
    fs::copy(&src, expected.join("sample.png")).unwrap();

    let input = CompareInput {
        actual_dir: actual,
        expected_dir: expected,
        diff_dir: diff,
        json: report.join("reg.json"),
        report: report.join("report.html"),
        url_prefix: String::new(),
        threshold_pixel: None,
        threshold_rate: 0.0,
        matching_threshold: 0.0,
        enable_antialias: false,
        concurrency: 2,
    };

    let result = run_compare(&input).expect("run_compare succeeds");
    eprintln!("result = {result:#?}");
    assert!(
        result.passed_items.iter().any(|s| s.contains("sample.png")),
        "expected 'sample.png' in passed_items, got: {:?}",
        result.passed_items
    );
    assert!(result.failed_items.is_empty());
    assert!(result.new_items.is_empty());
}

#[test]
fn new_image_with_no_expected_is_new() {
    let actual = make_tmp("actual_new");
    let expected = make_tmp("expected_new");
    let diff = make_tmp("diff_new");
    let report = make_tmp("report_new");

    let src = fixture_dir().join("images/sample.png");
    fs::copy(&src, actual.join("only-actual.png")).unwrap();

    let input = CompareInput {
        actual_dir: actual,
        expected_dir: expected,
        diff_dir: diff,
        json: report.join("reg.json"),
        report: report.join("report.html"),
        url_prefix: String::new(),
        threshold_pixel: None,
        threshold_rate: 0.0,
        matching_threshold: 0.0,
        enable_antialias: false,
        concurrency: 2,
    };

    let result = run_compare(&input).expect("run_compare succeeds");
    eprintln!("result = {result:#?}");
    assert!(
        result
            .new_items
            .iter()
            .any(|s| s.contains("only-actual.png")),
        "expected 'only-actual.png' in new_items, got: {:?}",
        result.new_items
    );
}
