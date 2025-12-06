# GitHub Actions

This project uses GitHub Actions for CI/CD. This page describes how to run and test these actions locally to save
time and avoid cluttering the commit history with `fix ci` commits.

## Prerequisites

1. Docker: Ensure Docker is installed and running on your machine.
2. Act: We use gh act (an extension for the GitHub CLI) or the standalone act tool.

## Installation

1. Install the GitHub CLI extension:

    ```bash
    gh extension install https://github.com/nektos/gh-act
    ```

    (Or refer to the [official documentation](https://github.com/nektos/gh-act) for other installation methods.)

2. Crucial Configuration:

    To ensure act works with our workflow labels (like runs-on: `self-hosted`), create a configuration file so you don't have to type long flags every time.

    Create or edit `~/.config/act/actrc` (Linux/macOS) or `%USERPROFILE%\.config\act\actrc` (Windows) and add:

    ```plaintext
    -P self-hosted=catthehacker/ubuntu:act-latest
    -P linux=catthehacker/ubuntu:act-latest
    ```

## Usage

Once configured, you can run actions from the repository root.

### List available jobs

See which jobs are available to run from your current workflows:

```bash
gh act -l
```

### Run a specific job

To run the eslint job (as defined in .github/workflows/eslint.yml):

```bash
gh act -j eslint
```

### Troubleshooting

Error: "Skipping unsupported platform" If you see this error, it means act doesn't know which Docker image to use for our custom runner labels.
Ensure you have completed the Configuration step above to map `self-hosted` to a valid Docker image.
