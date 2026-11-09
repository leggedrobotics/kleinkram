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

When the `dev` branch is stable and ready for a new release, a Pull Request is opened from `dev` to `main`. After
approval, this is merged to create a new release.

1. **Bump the version on `dev`.** All packages and the CLI share one version number. Run one of

    ```bash
    pnpm bump         # 0.63.4 -> 0.63.5
    pnpm bump:minor   # 0.63.4 -> 0.64.0
    pnpm bump:major   # 0.63.4 -> 1.0.0
    ```

    This sets the version in every `package.json` and in `cli/setup.cfg`. `pnpm validateVersions` checks that they all
    match. The API server rejects CLI versions with a different major version and warns about a different minor
    version, so bump the minor version when the API changes in a way older CLIs should notice.

2. **Open a Pull Request from `dev` to `main`.** The `check-version-number` workflow fails if the versions do not match
   or the version was not bumped. Some required checks only run on `dev`, so the head commit of the Pull Request must
   also be on `dev`.

3. **Merge.** Pushing to `main` then:
    - creates a GitHub release with the tag `v<version>` (`create-release`). Its description is the merge commit
      message, so add the changelog to the release afterwards.
    - builds the Docker images from `docker-compose.prod.yml` and pushes them as the `*-latest` images (`production-build`).
    - publishes the CLI to PyPI if anything in `cli/` changed (`update-pypi`).

4. **Run the database migrations** on the production database if the release contains any. See
   [Migrations](./migrations/migrations.md).

Every push to `dev` does the same for the staging environment: it pushes the `*-dev` images, and, if `cli/` changed,
publishes a pre-release of the CLI with the version `<version>-dev<timestamp>`.

## Reporting Issues

If you encounter a bug or have a feature request, please [open an issue on GitHub](https://github.com/leggedrobotics/kleinkram/issues).

## Seeking Support

For help and support:

1.  Check the [official documentation](https://docs.datasets.leggedrobotics.com/).
2.  If you can't find an answer, [open an issue on GitHub](https://github.com/leggedrobotics/kleinkram/issues).

## Next Steps

Ready to write code? Go to [Start Development](./getting-started.md) to set up your environment.
