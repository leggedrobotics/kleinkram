# GitHub Actions

This project uses GitHub Actions for CI/CD. This page describes how to run and test these actions locally.

## Running Actions Locally

To run GitHub Actions locally, we use `gh act`, a tool that allows you to run your GitHub Actions locally.

### Installation

Please refer to the [official documentation](https://nektosact.com/introduction.html) for installation instructions for your specific operating system.

### Usage

Once installed, you can run the actions defined in your `.github/workflows` directory.

#### Run CI/CD Tests

To run the CI/CD tests locally, you can use the following command:

```bash
gh act -j test
```

This command will execute the job named `test` from your workflow files. You can list all available jobs using:

```bash
gh act -l
```

For more advanced usage and options, please refer to the `gh act --help` command or the official documentation.
