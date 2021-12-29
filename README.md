<p align="center"><img src ="https://github.com/bokuweb/reg-actions/blob/main/logo.png?raw=true" /></p>

<p align="center">
    A visual regression test tool for github actions :octocat:.
</p>

---

[![GitHub Actions Status](https://github.com/bokuweb/reg-actions/workflows/CI/badge.svg)](https://github.com/bokuweb/reg-actions/actions)


## Table of Contents

* [How to use](#how-to-use)
  * [Minimal setup](#minimal-setup)
* [Contribute](#contribute)
* [License](#license)

## How to use

### Minimal setup

Let's start with a minimal workflow setup.

``` yaml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: bokuweb/reg-actions@v1
        with:
          github-token: "${{ secrets.GITHUB_TOKEN }}"
          image-directory-path: "./images"
```

### Action inputs

Input definitions are written in [action.yml](./action.yml).

#### `github-token` (Required)

- Type: String
- Default: N/A

GitHub API access token.
It is used to upload test report and add comment to pull request.

#### `image-directory-path` (Required)

- Type: String
- Default: N/A

Specify the directory path where the image to be tested is stored.
See also [test.yml](./.github/workflows/test.yml).


## Contribute

PRs welcome.

## License

The MIT License (MIT)

Copyright (c) 2022 bokuweb

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

![reg-viz](https://raw.githubusercontent.com/reg-viz/artwork/master/repository/footer.png)
