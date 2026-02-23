# Command-Line Interface (CLI)

Ensure you have installed the Kleinkram CLI and authenticated as described in the [Setup Guide](./setup.md).

## Getting Started

Here is a quick example of a common automated workflow: creating a project, uploading data, and building a Kleinkram action.

```bash
# 1. Create a Project and Mission
klein project create --project testProject --description "Just a Test Project for running actions"
echo "123" > test.yml
klein upload --project testProject --mission testMission --create test.yml

# 2. Build a test Action
# (Assuming you have an action definition in the current directory)
docker build -t <your-docker-hub-account>/test_action .
docker push <your-docker-hub-account>/test_action
```

## Core Workflows

Most commands require you to specify the target **Project** and **Mission**. You can provide these using the `--project` (or `-p` shorthand) and `--mission` (or `-m` shorthand) flags.

### Listing Resources

You can list available projects, missions, and files using the `list` command to explore your workspace.

```bash
# List all projects your user has access to
klein list projects

# List all missions within a specific project
klein list missions --project myproject

# List all files currently inside a mission
klein list files --project myproject --mission mymission
```

### Uploading Resources

Use the `upload` command to send local files to a mission.

```bash
klein upload --project myproject --mission mymission data.bag metadata.yaml
```

You can also use glob patterns and wildcards to upload multiple files efficiently:

```bash
klein upload --project myproject --mission mymission *.bag
```

::: tip Creating Missions on Upload
To create a mission automatically during upload if it doesn't already exist, use the `--create` flag. Note that the target project must already exist.

```bash
klein upload --create --project myproject --mission mymission *.bag
```

:::

### Downloading Resources

Use the `download` command to retrieve files from a mission to your local machine.

```bash
klein download --project myproject --mission mymission --dest ./downloaded_data
```

::: tip Nested Directories
By default, all downloaded files are saved directly in the destination directory, flattening the project and mission structure. To preserve this structure and group files into `<dest>/<project-name>/<mission-name>` subdirectories, use the `--nested` flag.

```bash
klein download -p myproject -m mymission --dest ./downloaded_data --nested
```

:::

### Verifying Resources

Use the `verify` command to double-check if your local files were successfully uploaded and processed by the Kleinkram backend.

```bash
klein verify --project myproject --mission mymission data.bag
```

## Supported File Types

The Kleinkram CLI supports uploading and verifying all standard file types. See the detailed [Files documentation](../files/files.md) for a comprehensive list of supported data formats and sizes.

## Additional Commands

For a full list of available commands and their sub-options, you can always use the standard `--help` flag:

```bash
klein --help
```
