# Python Setup

The `kleinkram` CLI allows you to interact with kleinkram from the command line. This guide will help you get started
with the CLI. The CLI does not yet support all functionalities so for some use cases you will still need to use the web
interface.

## Installation and Prerequisites

The CLI requires **Python 3.8 or later**. We recommend using the latest available Python version.

It is best practice to use a virtual environment:

```bash
# Create a virtual environment using your default python version
virtualenv .venv
source .venv/bin/activate
```

You can install the CLI using pip

```bash
pip install kleinkram
```

This will add the command `klein` to your path. You are ready to get started!

```bash
klein --help
```

## Authentication

If you want to use the CLI or the python package you need to authenticate yourself.
Either way, you need to do this using the CLI:

```bash
klein login
```

##### Alternative Authentication Methods

If the above does not work, consider one of the following options:

::: details Headless Authentication
In case your device does not support a browser, or if the default port **8000** is already in use, you can use:

```bash
klein login --headless
```

:::

### Choose another OAuth Provider

By default the CLI uses Google as OAuth provider. If you want to use another provider (e.g. GitHub) you can use:

```bash
klein login --oauth-provider github
```

Supported providers are `google` and `github`.

::: info Development Providers
For development purposes, a `fake-oauth` provider is available. See the [Developer Guide](../../development/getting-started.md#fake-oauth-provider) for more details.
:::

::: details Authentication inside Actions
When running the CLI inside a kleinkram action, the action will expose an environment variable
`APIKEY` which can be used to authenticate the CLI. In this case you need to use the following command:

```
klein login --key $APIKEY
```

:::

## Next Steps

- [using the CLI](./cli.md)
- For using the python package in your scripts, see the [Python SDK Reference](./sdk.md).
