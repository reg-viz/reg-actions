use anyhow::{Context, Result};

use reg_actions::client::ApiClient;
use reg_actions::config::Config;
use reg_actions::event;
use reg_actions::logger;
use reg_actions::repository::Repository;
use reg_actions::service::{self, ServiceInput};

#[tokio::main]
async fn main() -> Result<()> {
    logger::init();

    if let Err(e) = real_main().await {
        // GitHub Actions の `::error::` マーカに合わせてエラー出力
        eprintln!("::error::{e:#}");
        std::process::exit(1);
    }
    Ok(())
}

async fn real_main() -> Result<()> {
    let config = Config::from_env().context("load config")?;
    let event = event::get_event().context("load event")?;
    let repository = Repository::from_env().context("load repository")?;

    let run_id: u64 = std::env::var("GITHUB_RUN_ID")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let sha = std::env::var("GITHUB_SHA").unwrap_or_default();

    // ISO date YYYY-MM-DD (UTC)
    let date = chrono::Utc::now().format("%Y-%m-%d").to_string();

    tracing::info!(run_id, sha = %sha, "starting reg-actions");

    let client = ApiClient::new(repository, config.github_token.clone()).context("build client")?;

    service::run(ServiceInput {
        event,
        run_id,
        sha,
        date,
        config,
        client,
    })
    .await
}
