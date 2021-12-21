import * as l from 'loglevel';

if (process.env.NODE_ENV === 'test') {
  l.setLevel('silent');
} else if (process.env.ENV !== 'production') {
  l.setLevel('debug');
} else {
  l.setLevel('info');
}

export const log = {
  ...l,
};
