import { log } from './logger';
import { Config } from './config';
import * as constants from './constants';

const _compare = require('reg-cli');

export type CompareOutput = {
  passedItems: string[];
  failedItems: string[];
  newItems: string[];
  deletedItems: string[];
};

export const compare = async (config: Config): Promise<CompareOutput> =>
  new Promise<CompareOutput>(resolve => {
    const emitter = _compare({
      actualDir: `./__reg__/${constants.ACTUAL_DIR_NAME}`,
      expectedDir: `./__reg__/${constants.EXPECTED_DIR_NAME}`,
      diffDir: `./__reg__/${constants.DIFF_DIR_NAME}`,
      json: './__reg__/0',
      update: false,
      ignoreChange: true,
      urlPrefix: '',
      thresholdPixel: config.thresholdPixel,
      thresholdRate: config.thresholdRate,
      matchingThreshold: config.matchingThreshold,
      enableAntialias: config.enableAntialias,
    });

    emitter.on('complete', async result => {
      log.debug('compare result', result);
      resolve(result);
    });
  });