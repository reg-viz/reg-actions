//! ビルド時に `vendor/reg.wasm` の SHA256 を検証する。
//!
//! reg.wasm は reg-viz/reg-cli の公式リリース由来の wasm モジュール。
//! バイナリ改ざんを検出するため、期待ハッシュをここに固定する。
//!
//! ハッシュを更新する手順:
//!   1. `vendor/reg.wasm` を新しいビルドに差し替え
//!   2. `shasum -a 256 vendor/reg.wasm` で新しいハッシュを取得
//!   3. 下の `EXPECTED_SHA256` を更新
//!   4. `Cargo.toml` のコメントに対応する reg-cli バージョンを記録

use std::fs;
use std::io::Read;
use std::path::PathBuf;

/// reg-cli 0.19.0-rc0 (== @bokuweb/reg-cli-wasm@0.0.0-experimental7) 由来。
const EXPECTED_SHA256: &str = "05c1e06418761b2615effa413ae02eee3b1b242ab4356527e095fafafc51ad60";

fn main() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let wasm_path = manifest_dir.join("vendor").join("reg.wasm");

    println!("cargo:rerun-if-changed=vendor/reg.wasm");
    println!("cargo:rerun-if-changed=build.rs");

    let mut f = match fs::File::open(&wasm_path) {
        Ok(f) => f,
        Err(e) => panic!(
            "vendor/reg.wasm not found at {}: {e}\n\
             Download it from https://github.com/reg-viz/reg-cli/releases or \
             `npm pack @bokuweb/reg-cli-wasm@0.0.0-experimental7` and copy dist/reg.wasm.",
            wasm_path.display()
        ),
    };
    let mut buf = Vec::new();
    f.read_to_end(&mut buf).expect("read vendor/reg.wasm");

    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(&buf);
    let actual = format!("{:x}", hasher.finalize());

    if actual != EXPECTED_SHA256 {
        panic!(
            "vendor/reg.wasm SHA256 mismatch.\n  expected: {EXPECTED_SHA256}\n  actual:   {actual}\n\
             If you intentionally updated reg.wasm, update EXPECTED_SHA256 in build.rs."
        );
    }
}
