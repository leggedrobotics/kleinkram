# Kleinkram CLI Usage

Ensure you have installed the CLI and authenticated as described in the [Setup Guide](./setup.md).

## Getting Started

Here is a quick example of how to create a project, upload data, and run an action.

```bash
# 1. Create a Project and Mission
klein project create -p testProject -d "Just a Test Project for running actions"
echo "123" > test.yml
klein upload -p testProject -m testMission --create test.yml

# 2. Build a test Action
# (Assuming you have an action definition in the current directory)
docker build -t <your-docker-hub-account>/test_action .
docker push <your-docker-hub-account>/test_action
```

## Common Commands

Most commands require you to specify the **Project** and **Mission** you want to interact with. You can do this using the `-p` (or `--project`) and `-m` (or `--mission`) flags.

### Uploading Files

Use the `upload` command to send files to a mission.

```bash
klein upload -p myproject -m mymission data.bag metadata.yaml
```

You can also use wildcards:

```bash
klein upload -p myproject -m mymission *.bag
```

::: tip Creating Mission on Upload
To create a mission automatically during upload, use the `--create` flag. The project must already exist.

```bash
klein upload --create -p myproject -m mymission *.bag
```
:::

### Downloading Files

Use the `download` command to retrieve files from a mission.

```bash
klein download -p myproject -m mymission --dest ./downloaded_data
```

### Verifying Files

Use the `verify` command to check if files were uploaded correctly.

```bash
klein verify -p myproject -m mymission data.bag
```

### Listing Resources

You can list projects, missions, and files using the `list` command.

```bash
# List all projects
klein list projects

# List missions in a project
klein list missions -p myproject

# List files in a mission
klein list files -p myproject -m mymission
```

## Supported File Types

The CLI supports uploading and verifying all supported file types. See the [Files documentation](../files/files.md) for a complete list of supported formats.

## Other Commands

For a full list of available commands and options, you can always use the `--help` flag:

```bash
klein --help
```
