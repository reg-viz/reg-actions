import chalk from 'chalk';

import { log } from './logger';
import { Config } from './config';
import * as constants from './constants';
import { workspace } from './path';
import path from 'path/posix';
import cpy from 'cpy';

const _compare = require('reg-cli');

export type CompareOutput = {
  passedItems: string[];
  failedItems: string[];
  newItems: string[];
  deletedItems: string[];
};

export const compare = async (config: Config): Promise<CompareOutput> =>
  new Promise<CompareOutput>(async resolve => {
    const emitter = _compare({
      actualDir: path.join(workspace(), constants.ACTUAL_DIR_NAME),
      expectedDir: path.join(workspace(), constants.EXPECTED_DIR_NAME),
      diffDir: path.join(workspace(), constants.DIFF_DIR_NAME),
      json: path.join(workspace(), constants.JSON_NAME),
      report: path.join(workspace(), './report.html'),
      update: false,
      ignoreChange: true,
      urlPrefix: '',
      thresholdPixel: config.thresholdPixel,
      thresholdRate: config.thresholdRate,
      matchingThreshold: config.matchingThreshold,
      enableAntialias: config.enableAntialias,
    });

    if (config.reportFilePath) {
      log.info(`reportFilePath ${config.reportFilePath} detected`);
      try {
        await cpy(workspace() + '/**/*', config.reportFilePath);
        log.info(`Succeeded to copy reg data to ${config.reportFilePath}.`);
      } catch (e) {
        log.error(`Failed to copy reg data to ${config.reportFilePath} reason: ${e}`);
      }
    }

    emitter.on('complete', result => {
      log.debug('compare result', result);
      log.info('Comparison Complete');
      log.info(chalk.red('   Changed items: ' + result.failedItems.length));
      log.info(chalk.cyan('   New items: ' + result.newItems.length));
      log.info(chalk.redBright('   Deleted items: ' + result.deletedItems.length));
      log.info(chalk.green('   Passed items: ' + result.passedItems.length));
      resolve(result);
    });
  });
