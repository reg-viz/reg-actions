//! 画像比較: reg.wasm を wasmtime で実行する。
//!
//! ## reg.wasm の呼び出しプロトコル
//!
//! reg.wasm は WASI preview1 + wasi-threads モジュール:
//! - `env.memory` … 共有メモリ (`MemoryType::shared(256, 16384)`)
//! - `wasi_snapshot_preview1.*` … 標準 WASI (preopen で /actual /expected /diff /report)
//! - `wasi.thread-spawn` … wasmtime-wasi-threads が提供
//!
//! exports:
//! - `_start` … WASI 標準エントリ。WASI/argv 初期化を行う。
//! - `wasi_thread_start(tid: i32, start_arg: i32)` … スレッドワーカエントリ。
//! - **`wasm_main() -> i32`** … 比較を実行し、`WasmOutput` 構造体への
//!   ポインタを返す。**`_start` の後に必ず呼ぶ。**
//! - **`free_wasm_output(ptr: i32)`** … 上記出力の解放。
//!
//! `WasmOutput` メモリレイアウト (linear memory 上、little-endian):
//!   ```text
//!   offset 0..4  : u32  len
//!   offset 4..8  : u32  buf_ptr
//!   ```
//! `buf_ptr..buf_ptr+len` の UTF-8 が `CompareOutput` の JSON。
//!
//! 参考実装: `@bokuweb/reg-cli-wasm@0.0.0-experimental7`
//! の `dist/entry.mjs` (Node.js Worker 実装)。

use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use wasmtime::{Config as WasmConfig, Engine, Linker, Module, Store};
use wasmtime_wasi::preview1::{self, WasiP1Ctx};
use wasmtime_wasi::{DirPerms, FilePerms, WasiCtxBuilder};
use wasmtime_wasi_threads::WasiThreadsCtx;

use crate::config::Config;

static REG_WASM: &[u8] = include_bytes!("../vendor/reg.wasm");

#[derive(Debug, Clone)]
pub struct CompareInput {
    pub actual_dir: PathBuf,
    pub expected_dir: PathBuf,
    pub diff_dir: PathBuf,
    pub json: PathBuf,
    pub report: PathBuf,
    pub url_prefix: String,
    pub threshold_pixel: Option<u64>,
    pub threshold_rate: f64,
    pub matching_threshold: f64,
    pub enable_antialias: bool,
    pub concurrency: u32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareOutput {
    #[serde(default)]
    pub passed_items: Vec<String>,
    #[serde(default)]
    pub failed_items: Vec<String>,
    #[serde(default)]
    pub new_items: Vec<String>,
    #[serde(default)]
    pub deleted_items: Vec<String>,
    #[serde(default)]
    pub expected_items: Vec<String>,
    #[serde(default)]
    pub actual_items: Vec<String>,
    #[serde(default)]
    pub diff_items: Vec<String>,
    pub actual_dir: Option<String>,
    pub expected_dir: Option<String>,
    pub diff_dir: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ComparePaths {
    pub actual: PathBuf,
    pub expected: PathBuf,
    pub diff: PathBuf,
    /// /report 配下のホスト側ディレクトリ。reg.wasm は ここに reg.json と report.html を書く。
    pub report_dir: PathBuf,
}

impl CompareInput {
    pub fn from_config(config: &Config, paths: &ComparePaths) -> Self {
        Self {
            actual_dir: paths.actual.clone(),
            expected_dir: paths.expected.clone(),
            diff_dir: paths.diff.clone(),
            json: paths.report_dir.join("reg.json"),
            report: config.report_file_path.clone(),
            url_prefix: String::new(),
            threshold_pixel: config.threshold_pixel,
            threshold_rate: config.threshold_rate,
            matching_threshold: config.matching_threshold,
            enable_antialias: config.enable_antialias,
            concurrency: 2,
        }
    }
}

/// WASI 内部 (guest) パスを使った argv を組み立てる。
/// `reg-cli` 形式に合わせ、最初に nominal program name を入れる。
/// preopen は: /actual, /expected, /diff, /report の 4 つ。
fn build_argv(input: &CompareInput) -> Vec<String> {
    let mut argv: Vec<String> = vec![
        "reg-cli".to_string(),
        "/actual".into(),
        "/expected".into(),
        "/diff".into(),
        "--report".into(),
        "/report/report.html".into(),
        "--json".into(),
        "/report/reg.json".into(),
        "--matchingThreshold".into(),
        format!("{}", input.matching_threshold),
        "--thresholdRate".into(),
        format!("{}", input.threshold_rate),
        "--concurrency".into(),
        format!("{}", input.concurrency),
    ];
    if let Some(p) = input.threshold_pixel {
        argv.push("--thresholdPixel".into());
        argv.push(format!("{p}"));
    }
    if input.enable_antialias {
        argv.push("--enableAntialias".into());
    }
    argv
}

/// WASI ホスト状態。`wasi-threads` が要求する `Clone + Send` を満たすため、
/// 各クローン (=各スレッド) は `factory` 経由で新しい `WasiP1Ctx` を持つ。
/// 共有メモリと thread-spawn ハンドラは `threads` 経由で共有される。
struct CompareHost {
    wasi: WasiP1Ctx,
    threads: Arc<OnceCell<Arc<WasiThreadsCtx<CompareHost>>>>,
    factory: Arc<dyn Fn() -> WasiP1Ctx + Send + Sync>,
}

impl Clone for CompareHost {
    fn clone(&self) -> Self {
        Self {
            wasi: (self.factory)(),
            threads: self.threads.clone(),
            factory: self.factory.clone(),
        }
    }
}

fn build_wasi_factory(
    actual: PathBuf,
    expected: PathBuf,
    diff: PathBuf,
    report: PathBuf,
    argv: Vec<String>,
) -> Arc<dyn Fn() -> WasiP1Ctx + Send + Sync> {
    Arc::new(move || {
        let mut b = WasiCtxBuilder::new();
        b.inherit_stdio()
            .args(&argv)
            .preopened_dir(&actual, "/actual", DirPerms::READ, FilePerms::READ)
            .expect("preopen /actual")
            .preopened_dir(&expected, "/expected", DirPerms::READ, FilePerms::READ)
            .expect("preopen /expected")
            .preopened_dir(&diff, "/diff", DirPerms::all(), FilePerms::all())
            .expect("preopen /diff")
            .preopened_dir(&report, "/report", DirPerms::all(), FilePerms::all())
            .expect("preopen /report");
        b.build_p1()
    })
}

/// reg.wasm を wasmtime で実行し、CompareOutput を返す。
///
/// 同期ブロッキング処理。長時間 (画像数枚で数百 ms〜) 走るので、
/// 呼び出し側は `tokio::task::spawn_blocking` で包むこと。
pub fn run_compare(input: &CompareInput) -> Result<CompareOutput> {
    // Engine: wasi-threads が要求する threads サポートを ON
    let mut wcfg = WasmConfig::new();
    wcfg.wasm_threads(true);
    // 大きな画像 (高解像度 PNG など) を扱うと reg.wasm 内の dlmalloc が
    // 数百 MB 単位の連続領域を要求し、デフォルトのメモリ予約サイズでは
    // memory.grow に失敗して `unreachable` トラップを起こすケースがある。
    // wasm32 の linear memory 上限である 4 GiB まで予約を引き上げ、
    // guard も最大化することで、モジュールが宣言する max まで素直に
    // 伸ばせるようにする。
    // 実効上限は reg.wasm 側の `(memory ... max)` 宣言 (現在 1 GiB) が
    // 律速するため、それ以上必要な場合は wasm 側の再ビルドが必要。
    const WASM32_MAX: u64 = 1 << 32; // 4 GiB
    wcfg.static_memory_maximum_size(WASM32_MAX);
    wcfg.static_memory_guard_size(WASM32_MAX);
    wcfg.dynamic_memory_guard_size(WASM32_MAX);
    wcfg.dynamic_memory_reserved_for_growth(WASM32_MAX);
    let engine = Engine::new(&wcfg).context("create wasmtime engine")?;

    let module = Module::new(&engine, REG_WASM).context("compile reg.wasm")?;

    // ホスト状態の準備
    let factory = build_wasi_factory(
        input.actual_dir.clone(),
        input.expected_dir.clone(),
        input.diff_dir.clone(),
        // /report は reg.json/report.html の出力先 (ホスト側ディレクトリ)
        input
            .json
            .parent()
            .ok_or_else(|| anyhow!("input.json must have a parent dir"))?
            .to_path_buf(),
        build_argv(input),
    );
    let threads_slot: Arc<OnceCell<Arc<WasiThreadsCtx<CompareHost>>>> = Arc::new(OnceCell::new());
    let host = CompareHost {
        wasi: (factory)(),
        threads: threads_slot.clone(),
        factory: factory.clone(),
    };

    let mut store = Store::new(&engine, host);

    // Linker: WASI preview1 + wasi-threads
    let mut linker: Linker<CompareHost> = Linker::new(&engine);
    preview1::add_to_linker_sync(&mut linker, |h: &mut CompareHost| &mut h.wasi)
        .context("link wasi preview1")?;
    // get_cx は `Copy` を要求されるためキャプチャなしの fn 形式で渡す。
    // `h.threads` は OnceCell で、wasi-threads の thread-spawn が呼ばれる
    // タイミング (= main instance 実行中) には必ず初期化済み。
    fn get_threads(h: &mut CompareHost) -> &WasiThreadsCtx<CompareHost> {
        h.threads
            .get()
            .expect("WasiThreadsCtx not initialized before thread-spawn call")
            .as_ref()
    }
    wasmtime_wasi_threads::add_to_linker(&mut linker, &store, &module, get_threads)
        .context("link wasi-threads")?;

    // wasi-threads の InstancePre には完全な Linker が必要なので、ここで Arc 化。
    let linker_arc = Arc::new(linker);
    let threads_ctx = Arc::new(
        WasiThreadsCtx::new(module.clone(), linker_arc.clone()).context("create WasiThreadsCtx")?,
    );
    threads_slot
        .set(threads_ctx)
        .map_err(|_| anyhow!("threads_slot already set"))?;

    // メイン instance を作成 (linker は Arc にしてしまったので参照経由で使う)
    let instance = linker_arc
        .instantiate(&mut store, &module)
        .context("instantiate reg.wasm")?;

    // 1) _start を呼んで WASI/argv 初期化
    let start = instance
        .get_typed_func::<(), ()>(&mut store, "_start")
        .context("missing _start export")?;
    start.call(&mut store, ()).context("_start failed")?;

    // 2) wasm_main() を呼ぶ → WasmOutput への i32 ポインタを返す
    let wasm_main = instance
        .get_typed_func::<(), i32>(&mut store, "wasm_main")
        .context("missing wasm_main export")?;
    let output_ptr = wasm_main.call(&mut store, ()).context("wasm_main failed")?;
    if output_ptr <= 0 {
        anyhow::bail!("wasm_main returned non-positive pointer: {output_ptr}");
    }

    // 3) shared memory から WasmOutput を読み出す
    //    env.memory は import なので instance.get_memory では取れない。
    //    wasi-threads が Linker に登録した SharedMemory を引き出す。
    let env_extern = linker_arc
        .get(&mut store, "env", "memory")
        .ok_or_else(|| anyhow!("env.memory not in linker"))?;
    let shared_memory = env_extern
        .into_shared_memory()
        .ok_or_else(|| anyhow!("env.memory is not a SharedMemory"))?;
    // SAFETY: wasm_main は既に return しており、wasi-threads が起動した
    // 全ワーカも join 済み。この時点で memory への並行書込はない。
    let json = unsafe {
        let cells = shared_memory.data();
        let bytes = std::slice::from_raw_parts(cells.as_ptr().cast::<u8>(), cells.len());
        read_wasm_output(bytes, output_ptr as u32).context("decode WasmOutput")?
    };

    // 4) free_wasm_output
    let free = instance
        .get_typed_func::<i32, ()>(&mut store, "free_wasm_output")
        .context("missing free_wasm_output export")?;
    free.call(&mut store, output_ptr)
        .context("free_wasm_output failed")?;

    // 5) JSON → CompareOutput
    let parsed: CompareOutput = serde_json::from_str(&json).context("parse CompareOutput JSON")?;
    Ok(parsed)
}

/// `wasm_main()` の戻り値から `WasmOutput { len: u32, buf_ptr: u32 }` を読み、
/// `buf_ptr..buf_ptr+len` の UTF-8 を取り出す。
pub fn read_wasm_output(mem: &[u8], output_ptr: u32) -> Result<String> {
    let p = output_ptr as usize;
    if p + 8 > mem.len() {
        anyhow::bail!(
            "WasmOutput pointer ({p}) + 8 exceeds memory size ({})",
            mem.len()
        );
    }
    let len = u32::from_le_bytes(mem[p..p + 4].try_into().unwrap()) as usize;
    let buf = u32::from_le_bytes(mem[p + 4..p + 8].try_into().unwrap()) as usize;
    if buf + len > mem.len() {
        anyhow::bail!(
            "WasmOutput buf_ptr ({buf}) + len ({len}) exceeds memory size ({})",
            mem.len()
        );
    }
    let s = std::str::from_utf8(&mem[buf..buf + len])
        .with_context(|| "WasmOutput buffer is not valid UTF-8")?;
    Ok(s.to_string())
}

/// 互換性チェック用: 既存 reg.json を読んで CompareOutput にデコードする。
pub fn read_reg_json(path: &std::path::Path) -> Result<CompareOutput> {
    let raw = std::fs::read_to_string(path)
        .with_context(|| format!("failed to read reg.json at {}", path.display()))?;
    let parsed: CompareOutput = serde_json::from_str(&raw)
        .with_context(|| format!("failed to parse reg.json at {}", path.display()))?;
    Ok(parsed)
}

/// 高レベルラッパー: tokio から呼ぶ用。`spawn_blocking` で wasmtime を回す。
pub async fn compare(config: &Config, paths: ComparePaths) -> Result<CompareOutput> {
    let input = CompareInput::from_config(config, &paths);
    tokio::task::spawn_blocking(move || run_compare(&input))
        .await
        .context("compare worker join")?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn argv_basic() {
        let input = CompareInput {
            actual_dir: "/tmp/a".into(),
            expected_dir: "/tmp/e".into(),
            diff_dir: "/tmp/d".into(),
            json: "/tmp/r/reg.json".into(),
            report: "/tmp/r/report.html".into(),
            url_prefix: String::new(),
            threshold_pixel: Some(10),
            threshold_rate: 0.05,
            matching_threshold: 0.0,
            enable_antialias: true,
            concurrency: 2,
        };
        let argv = build_argv(&input);
        assert_eq!(argv[0], "reg-cli");
        assert!(argv.contains(&"--enableAntialias".to_string()));
        assert!(argv.contains(&"--thresholdPixel".to_string()));
        assert!(argv.contains(&"10".to_string()));
    }

    #[test]
    fn output_schema_roundtrip() {
        let json = r#"{"passedItems":["a.png"],"failedItems":[],"newItems":[],"deletedItems":[],"expectedItems":["a.png"],"actualItems":["a.png"],"diffItems":[]}"#;
        let parsed: CompareOutput = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.passed_items, vec!["a.png".to_string()]);
        assert!(parsed.failed_items.is_empty());
    }

    #[test]
    fn read_wasm_output_decodes_struct() {
        let mut mem = vec![0u8; 64];
        mem[16..20].copy_from_slice(&11u32.to_le_bytes());
        mem[20..24].copy_from_slice(&32u32.to_le_bytes());
        mem[32..43].copy_from_slice(b"hello world");
        let s = read_wasm_output(&mem, 16).unwrap();
        assert_eq!(s, "hello world");
    }

    #[test]
    fn read_wasm_output_rejects_oob() {
        let mem = vec![0u8; 8];
        assert!(read_wasm_output(&mem, 4).is_err());
    }
}
