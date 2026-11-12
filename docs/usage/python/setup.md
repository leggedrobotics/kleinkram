# Python Setup

The `kleinkram` CLI allows you to interact with Kleinkram directly from the command line. This guide will help you get started with the CLI. While it covers core workflows, some advanced administrative features still require the web interface.

## Installation and Prerequisites

The CLI requires **Python 3.10 or later**. We recommend using the latest available Python version.

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

The CLI and the Python SDK share one login. Log in with:

```bash
klein login
```

This opens the login page of the selected [endpoint](#endpoints-and-self-hosted-instances) in your browser. After you
log in, the browser hands the tokens back to the CLI through a short-lived server on your machine, on port 8000 or, if
that is taken, any free port. The tokens are saved in `~/.kleinkram.json`, and the SDK picks them up from there.

::: tip Summary

| Situation                                 | What to do                                           |
| ----------------------------------------- | ---------------------------------------------------- |
| Laptop or workstation with a browser      | `klein login`                                        |
| Remote machine, e.g. over SSH             | `klein login`; without a browser it logs in headless |
| The browser can't reach the CLI's machine | `klein login --headless`                             |
| Inside a Kleinkram action                 | Nothing: the action is already authenticated         |
| Log in with GitHub instead of Google      | `klein login --oauth-provider github`                |

:::

### Headless Login

If the CLI finds no browser, for example on a robot or a server you reach over SSH, it logs in headless: it prints a
URL, which you open in a browser on any device. After you log in, the page shows an authentication token and a refresh
token; copy them into the prompts of the CLI.

The browser flow only works if the browser can reach `localhost` of the machine the CLI runs on. If the login page
opens somewhere else, or the CLI picks a terminal browser you don't want to use, force the headless flow:

```bash
klein login --headless
```

::: details Authentication inside Actions
Inside a Kleinkram action you don't need to run `klein login`. The action container sets `KLEINKRAM_API_KEY` (together with `KLEINKRAM_API_ENDPOINT` and `KLEINKRAM_S3_ENDPOINT`), and the CLI picks these up automatically, so commands like `klein upload` or `klein download` work out of the box.

These variables are only used when there is no saved `~/.kleinkram.json`. If your action image ships one, remove it before running CLI commands, otherwise the CLI uses the saved endpoint and credentials instead.

:::

### Customizing the OAuth Provider

By default, the CLI logs in with Google. To use another provider (e.g. GitHub), specify it via the flag:

```bash
klein login --oauth-provider github
```

Supported providers are `google` and `github`.

::: info Development Providers
For local development purposes, a `fake-oauth` provider is also available. See the [Developer Guide](../../development/getting-started.md#fake-oauth-provider) for more details.
:::

### Logging Out

`klein logout` removes the saved credentials for the selected endpoint. `klein logout --all` removes them for every
endpoint.

## Endpoints and Self-Hosted Instances

By default the CLI talks to the public Kleinkram instance at `datasets.leggedrobotics.com`. To use another instance,
for example one you host yourself, register it as an endpoint. An endpoint is a name plus the URL of the API server and
the URL of the S3 storage:

```bash
# list the known endpoints; the selected one is marked
klein endpoint

# add an endpoint and select it
klein endpoint my-instance https://api.kleinkram.example.com https://s3.kleinkram.example.com

# switch to an endpoint that is already known
klein endpoint my-instance

# log in to the selected endpoint
klein login
```

Three endpoints are built in:

| Name    | API                                           | S3                                           |
| ------- | --------------------------------------------- | -------------------------------------------- |
| `prod`  | `https://api.datasets.leggedrobotics.com`     | `https://s3.datasets.leggedrobotics.com`     |
| `dev`   | `https://api.datasets.dev.leggedrobotics.com` | `https://s3.datasets.dev.leggedrobotics.com` |
| `local` | `http://localhost:3000`                       | `http://localhost:9000`                      |

A release of `kleinkram` from PyPI selects `prod` by default, a `-dev` pre-release selects `dev`, and an editable
install from a clone of the repository selects `local`.

Credentials are stored per endpoint, so you stay logged in to each endpoint you have used. The endpoints, the selected
endpoint and the credentials are saved in `~/.kleinkram.json`.

## Next Steps

- Read the [CLI Documentation](./cli.md) to discover core workflows.
- For using the python package in automated scripts, see the [Python SDK Reference](./sdk.md).
