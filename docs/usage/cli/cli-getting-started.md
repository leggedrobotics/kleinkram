# Getting Started with the CLI

The `kleinkram` CLI allows you to interact with your Kleinkram instance from the command line. This guide will help you
get started with the CLI.

## Installation and Prerequisites

The CLI assumes that you have python3 installed on your system. The CLI is distributed as a standalone pip package. You
can install it using pip. After installing the CLI, you can use the `klein` command to interact with your Kleinkram
instance.

```bash
pip install kleinkram
```

## Authentication

In order to use the CLI, you need to authenticate with your Kleinkram instance. You can do this by running the following

```bash
klein login
```

::: details Headless Authentication (Optional)
If you are running the CLI on a headless server, you can use the `--no-open-browser` flag to authenticate without
opening a browser window:

```bash
klein login --no-open-browser
```

:::

## Advanced Usage

The CLI is designed to support UNIX pipes between commands. Some advanced usage examples are shown below.

For by default we thus write uuids to stdout and humain readable information to stderr. This allows you to use UNIX
pipes to chain commands together by passing the output of one command as input to another command.

:::details Generate List of all Mission UUIDs
The following command generates a list of all mission UUIDs in your Kleinkram instance (where you have the necessary
permissions):

```bash
klein project list 2>/dev/null | xargs -n1 klein project details 2>/dev/null
```

The command uses the `project list` command to generate a list of all mission UUIDs, and then uses `xargs` to pass each
to the `klein project details` command. While suppressing stderr.
:::