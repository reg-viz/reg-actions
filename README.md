<p align="center"><img src ="https://github.com/bokuweb/reg-actions/blob/main/logo.png?raw=true" /></p>

<p align="center">
    A visual regression test tool for github actions :octocat:.
</p>

---

[![GitHub Actions Status](https://github.com/bokuweb/reg-actions/workflows/CI/badge.svg)](https://github.com/bokuweb/reg-actions/actions)


## Table of Contents

* [What is reg-actions](#what-is-reg-actions)
* [How to use](#how-to-use)
  * [Minimal setup](#minimal-setup)
  * [Action inputs](#action-inputs)
* [Authorization](#authorization)
* [Limitation](#limitation)
* [Contribute](#contribute)
* [License](#license)

## What is `reg-actions`.

This repository provides a `GitHub Action` for visual regression testing.   
(See also related projects [reg-suit](https://github.com/reg-viz/reg-suit) and [reg-cli](https://github.com/reg-viz/reg-cli)).   

This action uploads images and report as workflow artifact.   
The html report is generated by downloading and comparing the artifacts from the branch where the pull request will be merged.   
If the action succeeds, you will see the following html report.   
   
So, this action does *not* take screenshot, please generate images by your self.   
If you use `storybook`, we recommend using [storycap](https://github.com/reg-viz/storycap)   

![open](https://github.com/reg-viz/reg-cli/raw/master/docs/open.png)
![viewer](https://github.com/reg-viz/reg-cli/raw/master/docs/viewer.png)

## How to use

### Minimal setup

Let's start with a minimal workflow setup.    
Please add `on: [push, pull_request]` to make it work correctly.   
The `github-token` is required to download and upload artifacts.

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

Path to images directory.The images stored in this directory will be compared with the expected images from the last upload.

#### `enable-antialias` (Optional)

- Type: Boolean
- Default: `false`

Enable antialias. If omitted false.

#### `matching-threshold` (Optional)

- Type: Number
- Default: N/A

Matching threshold, ranges from 0 to 1. Smaller values make the comparison more sensitive. 0 by default.
Specifically, you can set how much of a difference in the YIQ difference metric should be considered a different pixel.
If there is a difference between pixels, it will be treated as "same pixel" if it is within this threshold.

#### `threshold-rate` (Optional)

- Type: Number
- Default: N/A

The rate threshold at which the image is considered changed. When the difference ratio of the image is larger than the set rate detects the change. Applied after `matchingThreshold`. 0 by default.

#### `threshold-pixel` (Optional)

- Type: Number
- Default: N/A

The pixel threshold at which the image is considered changed. When the difference pixel of the image is larger than the set pixel detects the change. This value takes precedence over `thresholdRate`. Applied after `matchingThreshold`. 0 by default.

## Authorization

The reg-actions report is created as a `Github Oauth App` that requires the `repo` scope.    
This is because, the report download artifact directly and it needs the `repo` scope to download the `artifact`.   

So if you use this action in private repository, please check [Restricting access to your organization's data](https://docs.github.com/ja/organizations/restricting-access-to-your-organizations-data).

## Limitation

- If the `artifact` is deleted, the report will also be deleted, see [`Artifact and log retention policy`](https://docs.github.com/ja/actions/learn-github-actions/usage-limits-billing-and-administration#artifact-and-log-retention-policy) for the retention period of the `artifact`.

## Contribute

Thanks for your help improving the project! We are so happy to have you!

## License

The MIT License (MIT)

Copyright (c) 2022 bokuweb

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

![reg-viz](https://raw.githubusercontent.com/reg-viz/artwork/master/repository/footer.png)