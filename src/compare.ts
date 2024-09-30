import chalk from 'chalk';
import * as path from 'path';

import { log } from './logger';
import { Config } from './config';
import * as constants from './constants';
import { workspace } from './path';

import { compare as _compare } from 'reg-cli';

export type CompareOutput = {
  passedItems: string[];
  failedItems: string[];
  newItems: string[];
  deletedItems: string[];
};

export const compare = async (config: Config): Promise<CompareOutput> =>
  new Promise<CompareOutput>(resolve => {
    const emitter = _compare({
      actualDir: path.join(workspace(), constants.ACTUAL_DIR_NAME),
      expectedDir: path.join(workspace(), constants.EXPECTED_DIR_NAME),
      diffDir: path.join(workspace(), constants.DIFF_DIR_NAME),
      json: path.join(workspace(), constants.JSON_NAME),
      report: config.reportFilePath || "./report.html",
      // update: false, TODO:
      // ignoreChange: true, TODO:
      urlPrefix: '',
      thresholdPixel: config.thresholdPixel,
      thresholdRate: config.thresholdRate,
      matchingThreshold: config.matchingThreshold,
      enableAntialias: config.enableAntialias,
    });

    emitter.on('complete', async result => {
      log.debug('compare result', result);
      log.info('Comparison Complete');
      log.info(chalk.red('   Changed items: ' + result.failedItems.length));
      log.info(chalk.cyan('   New items: ' + result.newItems.length));
      log.info(chalk.redBright('   Deleted items: ' + result.deletedItems.length));
      log.info(chalk.green('   Passed items: ' + result.passedItems.length));
      resolve(result);
    });
  });
