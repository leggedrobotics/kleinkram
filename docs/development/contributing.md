# Contributing to Kleinkram

Thank you for your interest in contributing to Kleinkram!

## Branching Strategy

Kleinkram uses a two-branch strategy with `main` and `dev` as protected branches.

| Branch | Purpose                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `main` | Production-ready code. All releases are made from this branch.                                                           |
| `dev`  | Main development branch. This is built and hosted as a staging environment for testing production builds before release. |

### Feature Branches

When developing a new feature or fix, create a branch from `dev` with one of the following prefixes:

| Prefix  | Purpose      | Example                       |
| ------- | ------------ | ----------------------------- |
| `feat/` | New features | `feat/add-mcap-visualization` |
| `fix/`  | Bug fixes    | `fix/upload-timeout`          |

## Pull Request Workflow

1.  **Create a feature branch** from `dev`.
2.  **Implement your changes** and ensure all tests pass locally.
3.  **Open a Pull Request** targeting the upstream `dev` branch.
4.  **Wait for CI checks** to pass. All PRs must pass the automated checks.
5.  **Address review comments** and get your PR approved.
6.  **Merge** your PR into `dev`.

::: tip
Every Pull Request must pass automated CI/CD checks. For details on what checks run and how to run tests locally see [Testing documentation](/development/testing/getting-started.md).
:::

## Release Workflow

When the `dev` branch is stable and ready for a new release, a Pull Request is opened from `dev` to `main`. After approval, this is merged to create a new release.

## Reporting Issues

If you encounter a bug or have a feature request, please [open an issue on GitHub](https://github.com/leggedrobotics/kleinkram/issues).

## Seeking Support

For help and support:

1.  Check the [official documentation](https://docs.datasets.leggedrobotics.com/).
2.  If you can't find an answer, [open an issue on GitHub](https://github.com/leggedrobotics/kleinkram/issues).

## Next Steps

Ready to write code? Go to [Start Development](./getting-started.md) to set up your environment.
