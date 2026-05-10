# Rust + wasmtime port

## Why

Recent npm supply-chain attacks have repeatedly compromised popular GitHub
Actions through trusted dependencies. The original `reg-actions` JS bundle
pulled in **17 direct npm packages** plus hundreds of transitive deps, all
loaded into the runner's Node.js process at execution time.

This rewrite ships the action as a **single signed Rust binary** distributed
via GitHub Releases. The full image-comparison pipeline still runs `reg.wasm`
(the Rust→WebAssembly engine published as part of `reg-cli` 0.19.0-rc0), but
now via [`wasmtime`](https://wasmtime.dev/) embedded into the Rust binary.

| | JS (legacy) | Rust + wasmtime (new) |
|---|---|---|
| Direct deps | 17 npm | ~25 Cargo crates |
| Transitive surface | ~hundreds | ~hundreds (but pinned by `Cargo.lock`) |
| Distribution | committed `dist/` JS bundle on a `vN` git branch | tar.gz binaries on GitHub Releases |
| Integrity | none | SHA256 + cosign keyless signature + SLSA build provenance |
| Runtime | Node.js 20 (`runs: node20`) | self-contained native binary (`runs: composite`) |
| Image diff | Wasm via `@bokuweb/reg-cli-wasm` (Node Worker threads) | identical `reg.wasm` via `wasmtime` + `wasi-threads` |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ action.yml (composite)                              │
│  1. detect runner target (uname -s/-m)              │
│  2. curl reg-actions-${target}.tar.gz from Releases │
│  3. SHA256 verify against checksums.txt             │
│  4. (optional) cosign verify-blob                   │
│  5. exec ./reg-actions                              │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│  reg-actions (Rust, ~12 MB single binary)           │
│  ├─ config.rs    13 INPUT_* env-var parser          │
│  ├─ event.rs     $GITHUB_EVENT_PATH JSON parser     │
│  ├─ run.rs       merge-base → workflow run search   │
│  ├─ client.rs    octocrab REST/GraphQL +            │
│  │               Artifact v4 (Twirl JSON over HTTP) │
│  ├─ git.rs       std::process git CLI wrapper       │
│  ├─ push.rs      orphan branch + retention          │
│  ├─ comment.rs   Markdown PR comment (pure)         │
│  ├─ compare.rs   wasmtime + wasi-threads + reg.wasm │
│  └─ service.rs   orchestration                      │
└─────────────────────────────────────────────────────┘
```

## reg.wasm protocol

`reg.wasm` is a WASI preview1 module that imports:

- `env.memory` (a *shared* `WebAssembly.Memory` of `MemoryType::shared(256, 16384)`)
- `wasi_snapshot_preview1.*` (20 standard WASI calls)
- `wasi.thread-spawn` (the wasi-threads proposal)

…and exports:

- `_start`: standard WASI entry. Initializes argv/preopens.
- `wasi_thread_start(tid, start_arg)`: thread worker entry.
- **`wasm_main() -> i32`** *(non-standard)*: runs the actual comparison and
  returns a pointer to a `WasmOutput { u32 len; u32 buf_ptr }` struct in
  shared memory. Must be called *after* `_start`.
- **`free_wasm_output(ptr)`** *(non-standard)*: releases the above.

The Rust host:
1. Builds `wasmtime::Config::new().wasm_threads(true)`.
2. Lets `wasmtime_wasi_threads::add_to_linker` create the shared memory and
   the `wasi.thread-spawn` import.
3. Preopens four directories: `/actual`, `/expected`, `/diff`, `/report`.
4. Calls `_start`, then `wasm_main`, reads the `WasmOutput` from shared
   memory, parses the JSON, calls `free_wasm_output`.

`vendor/reg.wasm` is committed to the repo (~2.5 MB) and verified at build
time by [`build.rs`](../build.rs) against a pinned SHA256
(`05c1e064…1ad60`). Tampering causes a compile error.

## Distribution

A composite action plus prebuilt binaries per the dprint / taplo-cli pattern.

Targets (matrix in [`.github/workflows/release.yml`](../.github/workflows/release.yml)):

- `x86_64-unknown-linux-gnu`
- `aarch64-unknown-linux-gnu` (via `cross`)
- `x86_64-apple-darwin`
- `aarch64-apple-darwin`
- `x86_64-pc-windows-msvc`

Each release publishes:

- `reg-actions-${target}.tar.gz` (containing the binary)
- `checksums.txt` (sha256)
- `checksums.txt.sig` + `checksums.txt.pem` (cosign keyless signature)
- SLSA build provenance attestation via `actions/attest-build-provenance`

`action.yml` always SHA256-verifies the download. If `cosign` is on PATH
(install via `sigstore/cosign-installer` in your workflow), it additionally
verifies the keyless signature against the release workflow's OIDC identity:

```
--certificate-identity-regexp 'https://github\.com/reg-viz/reg-actions/\.github/workflows/release\.yml@.*'
--certificate-oidc-issuer 'https://token.actions.githubusercontent.com'
```

## Preview channel: `@rc-rust`

While the legacy JS bundle continues to power `@rc` (via `deploy-rc.yml`
pushing `dist/` to the `rc` branch), every push to `develop` also
**force-updates** a moving GitHub Release tagged `rc-rust` containing
fresh binaries for all 5 targets, signed with cosign keyless OIDC.

Try the Rust port without disturbing existing `@rc` users:

```yaml
- uses: reg-viz/reg-actions@rc-rust
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    image-directory-path: ./screenshots
```

Notes:
- Marked as a GitHub *prerelease* so it never appears as "Latest".
- Tag is force-replaced (delete + recreate) on every `develop` push, so
  pinning a SHA via Dependabot/Renovate is recommended for production
  consumers — `@rc-rust` is for try-it-out and dogfooding only.
- Once Phase 7 cutover lands, the regular `@rc` channel will switch to
  the Rust binary and `@rc-rust` will be retired.

## Migration status

- [x] Phase 0 — wasm protocol reverse-engineering, octocrab survey
- [x] Phase 1 — config / event / repository / logger / paths
- [x] Phase 2 — REST/GraphQL client (octocrab) + Artifact v4 (`reqwest` + Twirl JSON)
- [x] Phase 3 — wasmtime + wasi-threads + `reg.wasm` integration; e2e tests pass
- [x] Phase 4 — git CLI wrapper + push to artifact branch + retention policy
- [x] Phase 5 — Markdown comment generation + service orchestration
- [x] Phase 6 — composite `action.yml` + cross-build + cosign + SLSA workflows
- [ ] Phase 7 — **side-by-side validation** of legacy JS vs Rust binary on a
  real PR; cut over `runs.using` from `node20` to `composite` and remove
  `dist/` once parity is confirmed.

## Updating reg.wasm

When `reg-cli` releases a newer wasm:

1. `npm pack @bokuweb/reg-cli-wasm@<version>` (or download `reg.wasm` from
   the [reg-cli release](https://github.com/reg-viz/reg-cli/releases)).
2. Replace `vendor/reg.wasm`.
3. Update `EXPECTED_SHA256` in [`build.rs`](../build.rs) to the new hash
   (`shasum -a 256 vendor/reg.wasm`).
4. `cargo test` to verify the e2e tests still pass.
5. Update the upstream version reference in this document.

## Local development

```sh
# Run unit + e2e tests (requires no network).
cargo test --all

# Build the release binary.
cargo build --release --bin reg-actions

# Smoke test: should print `::error::load config: 'github-token' is not set`.
./target/release/reg-actions

# Lint & format.
cargo fmt --all
cargo clippy --all-targets -- -D warnings
```

## Dropping the legacy JS bundle

The legacy JS implementation is kept on disk during the migration. Once
Phase 7 confirms parity, run:

```sh
git rm -r src/*.ts dist/ package.json pnpm-lock.yaml tsconfig.json
git rm .github/workflows/test.yml          # superseded by rust.yml + rust-self-test.yml
git rm .github/workflows/deploy.yml        # superseded by release.yml
git rm .github/workflows/deploy-rc.yml     # superseded by release.yml
```

…and remove the corresponding entries from `.gitignore`.
