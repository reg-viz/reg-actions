import chalk from 'chalk';
import * as path from 'path';

import { log } from './logger';
import { Config } from './config';
import * as constants from './constants';
import { workspace } from './path';
import cpy from 'cpy';

import { compare as _compare } from '@bokuweb/reg-cli-wasm';

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
      concurrency: 2,
    });

    emitter.on('complete', result => {
      console.timeEnd('compare')
      log.debug('compare result', result);
      log.info('Comparison Complete');
      log.info(chalk.red('   Changed items: ' + result.failedItems.length));
      log.info(chalk.cyan('   New items: ' + result.newItems.length));
      log.info(chalk.redBright('   Deleted items: ' + result.deletedItems.length));
      log.info(chalk.green('   Passed items: ' + result.passedItems.length));
      resolve(result);
    });
  }).then(async (result) => {
    if (config.reportFilePath) {
      const dir = path.dirname(config.reportFilePath);
      log.info(`reportFilePath ${config.reportFilePath} detected`);
      log.info(`start copy reg data to ${dir}`);
      try {
        await cpy(workspace() + '/**/*', dir);
        log.info(`Succeeded to copy reg data to ${dir}.`);
      } catch (e) {
        log.error(`Failed to copy reg data to ${dir} reason: ${e}`);
      }
    }
    return result
  });
