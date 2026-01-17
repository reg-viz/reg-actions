import { basename } from 'path';

import { Event } from './event';
import { Run } from './run';
import { CompareOutput } from './compare';

export type CreateCommentWithTargetInput = {
  event: Event;
  runId: number;
  sha: string;
  regBranch: string;
  artifactName: string;
  targetRun: Run;
  result: CompareOutput;
  date: string;
  customReportPage: string | null;
  disableBranch: boolean;
  commentReportFormat: 'raw' | 'summarized';
  artifactId?: number;
};

export type CreateCommentWithoutTargetInput = {
  event: Event;
  runId: number;
  result: CompareOutput;
  artifactName: string;
  customReportPage: string | null;
};

const isSuccess = (result: CompareOutput) => {
  return result.failedItems.length === 0 && result.newItems.length === 0 && result.deletedItems.length === 0;
};

const badge = (result: CompareOutput) => {
  if (result.failedItems.length) {
    return '![change detected](https://img.shields.io/badge/%E2%9C%94%20reg-change%20detected-orange)';
  }
  if (result.newItems.length) {
    return '![new items](https://img.shields.io/badge/%E2%9C%94%20reg-new%20items-green)';
  }
  return '![success](https://img.shields.io/badge/%E2%9C%94%20reg-passed-green)';
};

const createBaseUrl = ({
  owner,
  repoName,
  branch,
  runId,
  artifactName,
  date,
}: {
  owner: string;
  repoName: string;
  branch: string;
  runId: number;
  artifactName: string;
  date: string;
}): string => {
  return `https://github.com/${owner}/${repoName}/blob/${branch}/${date}_${runId}_${artifactName}/`;
};

const differences = ({
  result,
  baseUrl,
  commentReportFormat,
}: {
  result: CompareOutput;
  baseUrl: string;
  commentReportFormat: 'raw' | 'summarized';
}): string => {
  if (result.failedItems.length === 0) return '';
  const comment = `   
     
### Differences
  
${result.failedItems
  .map(item => {
    const base = basename(item);
    const filename = encodeURIComponent(base);
    const actual = baseUrl + 'actual/' + filename + '?raw=true';
    const expected = baseUrl + 'expected/' + filename + '?raw=true';
    const diff = baseUrl + 'diff/' + filename + '?raw=true';
    const table = `
| actual|![Actual](${actual}) |
|--|--|
|expected|![Expected](${expected})|
|difference|![Difference](${diff})|
`;

    if (commentReportFormat === 'summarized') {
      return `<details><summary>${base}</summary>
${table}
</details>`;
    } else {
      return `### \`${base}\`
${table}`;
    }
  })
  .join('\n')}
  `;

  return comment;
};

const newItems = ({
  result,
  baseUrl,
  commentReportFormat,
}: {
  result: CompareOutput;
  baseUrl: string;
  commentReportFormat: 'raw' | 'summarized';
}): string => {
  if (result.newItems.length === 0) return '';
  const comment = `   
     
### New Items
  
${result.newItems
  .map(item => {
    const base = basename(item);
    const filename = encodeURIComponent(base);
    const img = baseUrl + 'actual/' + filename + '?raw=true';
    const table = `
|  |
|--|
|![NewItem](${img})|
`;
    if (commentReportFormat === 'summarized') {
      return `<details><summary>${base}</summary>
${table}
</details>`;
    } else {
      return `### \`${base}\`
${table}`;
    }
  })
  .join('\n')}
  `;

  return comment;
};

const deletedItems = ({
  result,
  baseUrl,
  commentReportFormat,
}: {
  result: CompareOutput;
  baseUrl: string;
  commentReportFormat: 'raw' | 'summarized';
}): string => {
  if (result.deletedItems.length === 0) return '';
  const comment = `   
   
### Deleted Items
  
${result.deletedItems
  .map(item => {
    const base = basename(item);
    const filename = encodeURIComponent(base);
    const img = baseUrl + 'expected/' + filename + '?raw=true';
    const table = `
|  |
|--|
|![DeleteItem](${img})|
`;
    if (commentReportFormat === 'summarized') {
      return `<details><summary>${base}</summary>
${table}
</details>`;
    } else {
      return `### \`${base}\`
${table}`;
    }
  })
  .join('\n')}
  `;

  return comment;
};

export const createCommentWithTarget = ({
  event,
  runId,
  regBranch,
  artifactName,
  artifactId,
  sha: currentHash,
  targetRun,
  result,
  date,
  customReportPage,
  disableBranch,
  commentReportFormat,
}: CreateCommentWithTargetInput): string => {
  const [owner, repoName] = event.repository.full_name.split('/');
  const targetHash = targetRun.head_sha;
  const currentHashShort = currentHash.slice(0, 7);
  const targetHashShort = targetHash.slice(0, 7);
  const baseUrl = createBaseUrl({ owner, repoName, branch: regBranch, runId, artifactName, date });

  const report =
    (result.failedItems.length === 0 && result.newItems.length === 0 && result.deletedItems.length === 0) ||
    disableBranch
      ? ''
      : `   
<details>
<summary>📝 Report</summary>
${differences({ result, baseUrl, commentReportFormat })}
${newItems({ result, baseUrl, commentReportFormat })}
${deletedItems({ result, baseUrl, commentReportFormat })}
</details>`;

  const reportUrl = customReportPage
    ? `   
Check out the report [here](${customReportPage}).`
    : '';
  const successOrFailMessage = isSuccess(result)
    ? `${badge(result)}

 ## ArtifactName: [\`${artifactName}\`](https://github.com/${owner}/${repoName}/actions/runs/${runId}/artifacts/${artifactId})
  
✨✨ That's perfect, there is no visual difference! ✨✨
${reportUrl}
    `
    : `${badge(result)}

 ## ArtifactName: [\`${artifactName}\`](https://github.com/${owner}/${repoName}/actions/runs/${runId}/artifacts/${artifactId})

${reportUrl}
    `;

  const body = `This report was generated by comparing [${currentHashShort}](https://github.com/${owner}/${repoName}/commit/${currentHash}) with [${targetHashShort}](https://github.com/${owner}/${repoName}/commit/${targetHash}).
If you would like to check difference, please check [here](https://github.com/${owner}/${repoName}/compare/${targetHashShort}..${currentHashShort}).
  
${successOrFailMessage}
  
| item    | count                         |
|:--------|:-----------------------------:|
| pass    | ${result.passedItems.length}  |
| change  | ${result.failedItems.length}  |
| new     | ${result.newItems.length}     |
| delete  | ${result.deletedItems.length} |
${report}
`;

  // comment body size limitation is 64KiB
  // So we set 60KiB with margin
  if (new Blob([body]).size > 60 * 1024) {
    const lines = body.split('\n');
    while (new Blob([lines.join('\n')]).size > 60 * 1024) {
      lines.pop();
    }
    lines.push('\n');
    lines.push('⚠️ report is omitted because comment body size limitation exceeded. Please check report in artifact.');
    return lines.join('\n');
  }
  return body;
};

export const createCommentWithoutTarget = ({
  result,
  artifactName,
  customReportPage,
}: CreateCommentWithoutTargetInput): string => {
  const report = customReportPage
    ? `   
  Check out the report [here](${customReportPage}).`
    : '';
  const body = `## ArtifactName: \`${artifactName}\`
  
Failed to find a target artifact.
All items will be treated as new items and will be used as expected data for the next time.

![target not found](https://img.shields.io/badge/%E2%9C%94%20reg-new%20items-blue)
${report}

| item    | count                         |
|:--------|:-----------------------------:|
| new     | ${result.newItems.length}     |
  `;

  // maximum is 65536 characters
  return body.slice(0, 65536);
};

export const isRegActionComment = ({ artifactName, body }: { artifactName: string; body: string }): boolean => {
  return (
    body.includes(`## ArtifactName: \`${artifactName}\``) || body.includes(`## ArtifactName: [\`${artifactName}\`]`)
  );
};

export const createResolvedComment = ({ artifactName }: { artifactName: string }): string => {
  return `![resolved](https://img.shields.io/badge/%E2%9C%94%20reg-resolved-green)

## ArtifactName: \`${artifactName}\`

✨ All visual differences have been resolved! ✨
`;
};
