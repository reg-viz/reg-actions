pub fn target_dir(run_id: u64, artifact_name: &str, date: &str) -> String {
    format!("{date}_{run_id}_{artifact_name}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_dir_format() {
        assert_eq!(target_dir(123, "reg", "2026-05-06"), "2026-05-06_123_reg");
    }
}
