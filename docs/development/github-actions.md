# GitHub Actions

This project uses GitHub Actions for CI/CD. This page lists the workflows and describes how to run them locally to
save time and avoid cluttering the commit history with `fix ci` commits.

## Workflows

All workflows live in `.github/workflows` and run on `ubuntu-latest`.

| Workflow                          | Runs on                                       | What it does                                                                          |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `eslint.yml`                      | PRs to `dev`, pushes to `dev`                 | Pre-commit hooks, type check, ESLint and Prettier                                     |
| `api-tests.yml`                   | PRs to `main` and `dev`                       | Queue consumer unit tests and API tests against the test stack                        |
| `cli-tests.yml`                   | PRs to `main` and `dev`                       | CLI tests against the test stack, on Python 3.10 and 3.13                             |
| `check-migrations.yml`            | PRs to `main` and `dev`                       | Checks that the migrations match the entities                                         |
| `check-version-number.yml`        | PRs to `main`                                 | Checks that the version was bumped and is the same in every package                   |
| `python-lint.yml`                 | Pushes to `dev` that change `cli/`            | Black                                                                                 |
| `dev-build.yml`                   | Pushes to `dev`                               | Builds and pushes the Docker images of the dev deployment                             |
| `production-build.yml`            | Pushes to `main`                              | Builds and pushes the Docker images of the production deployment                      |
| `create-release.yml`              | Pushes to `main`                              | Creates the GitHub release                                                            |
| `update-pypi.yml`                 | Pushes to `main` and `dev` that change `cli/` | Publishes the CLI to PyPI, then calls `build-sample-actions.yml`                      |
| `build-sample-actions.yml`        | Called by `update-pypi.yml`                   | Builds the example action images with the CLI wheel that was just published           |
| `automated-dependency-update.yml` | Mondays at midnight (UTC), or by hand         | Updates the npm dependencies within their ranges, bumps the patch version, opens a PR |
| `draft-pdf.yml`                   | Pushes that change `openjournals/`            | Builds the draft of the JOSS paper                                                    |

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

    Our workflows run on `ubuntu-latest`. Tell act which Docker image to use for that label in a configuration file, so you don't have to type long flags every time.

    Create or edit `~/.config/act/actrc` (Linux/macOS) or `%USERPROFILE%\.config\act\actrc` (Windows) and add:

    ```plaintext
    -P ubuntu-latest=catthehacker/ubuntu:act-latest
    ```

## Usage

Once configured, you can run actions from the repository root.

### List available jobs

See which jobs are available to run from your current workflows:

```bash
gh act -l
```

### Run a specific job

To run a specific job (e.g. `python-lint` from `.github/workflows/python-lint.yml`):

```bash
gh act -j python-lint
```

To capture the logs of an action into a file use:

```bash
gh act -j python-lint > python-lint.log 2>&1
```

### Troubleshooting

Error: "Skipping unsupported platform" If you see this error, it means act doesn't know which Docker image to use for
the runner label. Ensure you have completed the Configuration step above to map `ubuntu-latest` to a valid Docker image.
