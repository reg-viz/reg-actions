import * as path from 'path';
import * as constants from './constants';

export const workspace = () => {
  return path.join('./', constants.WORKSPACE_DIR_NAME);
};
