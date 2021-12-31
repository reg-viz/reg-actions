import * as l from 'loglevel';

if (process.env.NODE_ENV !== 'production') {
  l.setLevel('debug');
} else {
  l.setLevel('info');
}

export const log = {
  ...l,
};
