# Python Setup

The `kleinkram` CLI allows you to interact with Kleinkram directly from the command line. This guide will help you get started with the CLI. While it covers core workflows, some advanced administrative features still require the web interface.

## Installation and Prerequisites

The CLI requires **Python 3.8 or later**. We recommend using the latest available Python version.

It is best practice to always install Python packages inside a virtual environment:

```bash
# Create a virtual environment using your default python version
python -m venv .venv

# Activate the virtual environment
source .venv/bin/activate
```

Once activated, you can install the CLI using `pip`:

```bash
pip install kleinkram
```

This will add the command `klein` to your PATH. You are ready to get started!

```bash
klein --help
```

## Authentication

To use the CLI or the Python SDK, you must first authenticate your local setup. This is done exclusively using the CLI:

```bash
klein login
```

### Alternative Authentication Methods

If the default login process does not work for your environment, consider one of the following options:

::: details Headless Authentication
In case your device development server does not support a browser, or if the default port **8000** is already in use, you can run the login flow in headless mode:

```bash
klein login --headless
```

:::

::: details Authentication inside Actions
When running the CLI inside a Kleinkram automated action, the action exposes an environment variable `APIKEY` which bypasses the browser flow. In this scenario, authenticate using:

```bash
klein login --key $APIKEY
```

:::

### Customizing the OAuth Provider

By default, the CLI opens Google as the OAuth provider. If you want to use another provider (e.g. GitHub), specify it via the flag:

```bash
klein login --oauth-provider github
```

Supported providers are `google` and `github`.

::: info Development Providers
For local development purposes, a `fake-oauth` provider is also available. See the [Developer Guide](../../development/getting-started.md#fake-oauth-provider) for more details.
:::

## Next Steps

- Read the [CLI Documentation](./cli.md) to discover core workflows.
- For using the python package in automated scripts, see the [Python SDK Reference](./sdk.md).
