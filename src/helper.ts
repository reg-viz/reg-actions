export const targetDir = ({ runId, artifactName, date }: { runId: number; artifactName: string; date: string }) =>
  `${date}_${runId}_${artifactName}`;
