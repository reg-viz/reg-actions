import * as l from 'loglevel';

console.log(process.env.NODE_ENV, process.env)

if (process.env.NODE_ENV !== 'production') {
  l.setLevel('debug');
} else {
  l.setLevel('info');
}

export const log = {
  ...l,
};
