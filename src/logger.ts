import * as l from 'loglevel';

if (process.env.NODE_ENV === 'debug') {
  l.setLevel('debug');
} else {
  l.setLevel('info');
}

export const log = {
  ...l,
};
