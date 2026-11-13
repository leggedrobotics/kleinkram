# Python Setup

The `kleinkram` CLI allows you to interact with Kleinkram directly from the command line. This guide will help you get started with the CLI. While it covers core workflows, some advanced administrative features still require the web interface.

## Installation and Prerequisites

The CLI requires **Python 3.10 or later**; we test it on 3.10 and 3.13. We recommend Python 3.12 or later.

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

To use the CLI or the Python SDK, you must first log in. This is done exclusively using the CLI. The CLI has no
built-in server: the first time, pass the address of your Kleinkram web app, the one you open in the browser:

```bash
klein login https://datasets.example.org
```

The CLI looks up the API and storage addresses of that server (from `/.well-known/kleinkram.json` of the web app and
`/cli/config` of the API), saves the server and makes it the active one. You can also pass the address of the API, a
bare host name (`klein login datasets.example.org`) or a link to any page of the web app.

The server must use https. The CLI refuses plain `http://` addresses, including API or storage addresses the
server announces and redirects, except for `localhost` during local development.

The CLI then shows a short code such as `KQMX-TRBC` and opens the web app on the page `/cli/activate`. Sign in if
needed, check that the page shows the same code and click **Authorize CLI**. The terminal finishes the login by itself.
Codes are valid for 10 minutes.

Later, `klein login` without an address logs in to the active server again.

::: tip Copy the command from the web app
The terminal icon in the header of the web app shows the install and login commands with the address of that server
filled in.
:::

### Alternative Authentication Methods

::: details Without a browser (SSH, robots, servers)
If the machine has no browser (for example over SSH), the CLI prints the address of the activation page and the code
instead of opening a browser. Open the page on any other device, such as your laptop or phone, and enter the code.
Pass `--headless` to always print the code:

```bash
klein login datasets.example.org --headless
```

:::

::: details API keys for scripts and CI
`klein login --key <API_KEY>` stores an API key for the active server instead of logging in. In a fresh environment
(for example a CI job) there is no active server yet, so give the address as well:

```bash
klein login datasets.example.org --key "$API_KEY"
```

Instead of `klein login`, a script can also set the server and the key as environment variables:

```bash
export KLEINKRAM_API_ENDPOINT=https://api.datasets.example.org
export KLEINKRAM_S3_ENDPOINT=https://s3.datasets.example.org
export KLEINKRAM_API_KEY=<API_KEY>
```

All three are needed: the CLI no longer has a built-in server, so `KLEINKRAM_API_KEY` alone is not enough. Like
inside actions, the variables are only used when there is no saved `~/.kleinkram.json`. `klein login <url>` prints
both addresses, or open `<api address>/cli/config` in a browser.

Inside an action you need none of this: the action container sets all three variables for you (see below).
:::

::: details Authentication inside Actions
Inside a Kleinkram action you don't need to run `klein login`. The action container sets `KLEINKRAM_API_KEY` (together with `KLEINKRAM_API_ENDPOINT` and `KLEINKRAM_S3_ENDPOINT`), and the CLI picks these up automatically, so commands like `klein upload` or `klein download` work out of the box.

These variables are only used when there is no saved `~/.kleinkram.json`. If your action image ships one, remove it before running CLI commands, otherwise the CLI uses the saved endpoint and credentials instead.

:::

::: details Choosing the OAuth provider in the CLI
The login page in the browser lists every provider the server offers. To skip the code and log in through a local
callback port with one specific provider instead, pass it explicitly:

```bash
klein login --oauth-provider github
```

Supported providers are `google`, `github` and, for local development, `fake-oauth` (see the
[Developer Guide](../../development/getting-started.md#fake-oauth-provider)).
:::

### Logging Out

`klein logout` removes the saved credentials for the active server. `klein logout --all` removes them for every
server.

## Servers

The CLI can know several Kleinkram servers and keeps you logged in to each of them. Each `klein login <url>` adds a
server under its host name (for example `datasets.example.org`) and makes it the active one.

```bash
# list the saved servers; the active one is marked with *
klein host

# switch to a saved server
klein host use datasets.example.org

# forget a server and its login
klein host remove datasets.example.org
```

The servers, the active server and the credentials are saved in `~/.kleinkram.json`. Servers saved by older versions
of the CLI (`prod`, `dev`, `local`) keep working under their old names.

::: details Servers older than version 0.67
Older servers cannot be discovered from their address and have no login codes. Add them with the deprecated
`klein endpoint` command, giving the API and S3 addresses yourself, then log in:

```bash
klein endpoint my-instance https://api.kleinkram.example.com https://s3.kleinkram.example.com
klein login --oauth-provider github
```

`klein login` notices the older server and logs in through the browser with the chosen provider (Google if none is
given). Without a browser it prints a login address instead; open it on any device and paste the two tokens the page
shows.
:::
