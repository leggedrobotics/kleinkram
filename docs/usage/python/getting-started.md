# Getting Started with the Kleinkram CLI and Python Package

The `kleinkram` CLI allows you to interact with kleinkram from the command line. This guide will help you get started
with the CLI. The CLI does not yet support all functionalities so for some use cases you will still need to use the web
interface.

## Installation and Prerequisites

The CLI requires python3.8 or later. It is recommended that you use a virtual environment

```bash
virtualenv .venv -ppython3.8
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

If you want to use the CL or the python package you need to authenticate yourself.

Eitherway you need to do this using the CLI:

```bash
klein login
```

##### Alternative Authentication Methods

If the above does not work, consider one of the following options:

::: details Headless Authentication
In case your device does not support a browser you can use:

```
klein login --headless
```

:::

::: details Choose another OAuth Provider
By default the CLI uses Google as OAuth provider. If you want to use another provider you can use:

```
klein login --oauth-provider <provider>
```

where `<provider>` is one of `google`, `github`, or `fake-oauth`. Where the `fake-oauth` provider is only available on
development instances of kleinkram.

```

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
- [using the python package](./package.md)
```
