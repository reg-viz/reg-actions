# reg-cli-report-ui

[![GitHub Actions Status](https://github.com/reg-viz/reg-cli-report-ui/workflows/Continuous%20Integration/badge.svg)](https://github.com/reg-viz/reg-cli-report-ui/actions)

> :gem: New face of reg-cli report UI.

This repository is the Report UI of [reg-viz/reg-cli][reg-cli]

## Screenshots

![open](./docs/images/open.png)
![close](./docs/images/close.png)
![viewer](./docs/images/viewer.png)

## Available scripts

The following list is scripts used during development.

### `yarn start`

```bash
$ yarn start
```

Launch the Report UI with the mock data.

### `yarn build`

```bash
$ yarn build
```

Generate the JavaScript file required to embed Report UI. This is usually called in [reg-viz/reg-cli][reg-cli].

### `yarn typecheck`

```bash
$ yarn typecheck
```

Run static type checking using TypeScript.

### `yarn lint`

```bash
$ yarn lint
```

Run Lint with ESLint.

### `yarn format`

```bash
$ yarn format
```

Format the source code using Prettier and ESLint.

### `yarn storybook`

```bash
$ yarn storybook
```

Launch the component catalog with Storybook.

### `yarn scaffold`

```bash
$ yarn scaffold
```

Generate a component template.

## Contribute

PRs welcome.

## License

[MIT License @ reg-viz](./LICENSE)

![reg-viz](https://raw.githubusercontent.com/reg-viz/artwork/master/repository/footer.png)

[reg-cli]: https://github.com/reg-viz/reg-cli
