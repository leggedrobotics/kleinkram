# Command-Line Interface (CLI)

Ensure you have installed the Kleinkram CLI and authenticated as described in the [Setup Guide](./setup.md).

## Getting Started

Here is a quick example of a common automated workflow: creating a project, uploading data, and launching a Kleinkram action.

```bash
# 1. Create a Project and Mission
klein project create --project testProject --description "Just a Test Project for running actions"
echo "123" > test.yml
klein upload --project testProject --mission testMission --create test.yml

# 2. List Existing Kleinkram Action Templates
klein templates list

# (Assuming an action template named "extract-metadata" exists)
klein executions launch extract-metadata testMission --project testProject
```

## Core Workflows

Most commands require you to specify the target **Project** and **Mission**. You can provide these using the `--project` (or `-p` shorthand) and `--mission` (or `-m` shorthand) flags.

### Listing Resources

You can list available projects, missions, and files using the `list` command to explore your workspace.

```bash
# List all projects your user has access to
klein list projects

# List all missions within a specific project
klein list missions --project testProject

# List all files currently inside a mission
klein list files --project testProject --mission testMission
```

### Uploading Resources

Use the `upload` command to send local files to a mission.

```bash
klein upload --project testProject --mission testMission data.bag metadata.yaml
```

You can also use glob patterns and wildcards to upload multiple files efficiently:

```bash
klein upload --project testProject --mission testMission *.bag
```

::: tip Creating Missions on Upload
To create a mission automatically during upload if it doesn't already exist, use the `--create` flag. Note that the target project must already exist.

```bash
klein upload --create --project testProject --mission testMission *.bag
```

:::

### Downloading Resources

Use the `download` command to retrieve files from a mission to your local machine.

```bash
klein download --project testProject --mission testMission --dest ./downloaded_data
```

::: tip Nested Directories
By default, all downloaded files are saved directly in the destination directory, flattening the project and mission structure. To preserve this structure and group files into `<dest>/<project-name>/<mission-name>` subdirectories, use the `--nested` flag.

```bash
klein download -p testProject -m testMission --dest ./downloaded_data --nested
```

:::

### Verifying Resources

Use the `verify` command to double-check if your local files were successfully uploaded and processed by the Kleinkram backend.

```bash
klein verify --project testProject --mission testMission data.bag
```

### Running a Python Script as an Action

Use `klein action run-script` to run a single `.py` file on a mission without building or pushing a Docker image. The
logs are streamed and the command exits non-zero if the run did not finish cleanly.

```bash
klein action run-script ./analyse.py -p testProject -m testMission

# what the runner image ships; a script may not import anything else
klein action deps
```

See [Run a Single Python File](../actions/run-script.md) for the dependency set, the limits, and when to write a real
Docker action instead.

### Reporting from Inside an Action

`klein action warn`, `fail` and `info` only work from within a running Kleinkram action container, where Kleinkram provides the
credentials and the action id. Use them to tell the reader of the action what it found, rather than encoding it in the
exit code.

```bash
# the action still succeeds; it is shown as "DONE · 1 finding"
klein action warn "no /tf topic in this recording" --file run_1.bag --code MISSING_TF

# record an error without stopping the run
klein action fail "bag header is truncated" --file run_2.bag

# a note that leaves the action reading as clean
klein action info "checked 42 recordings"
```

See [Write Custom Action Templates](../actions/write-actions.md#raising-warnings) for the full description.

### Inspecting Action Runs

```bash
# the status column shows e.g. "DONE (3 warnings)"
klein executions list --mission testMission

# state, cause, who failed it, and how many findings it reported
klein executions info <execution-id>

# every warning and error the action reported about itself
klein executions diagnostics <execution-id>
```

## Supported File Types

The Kleinkram CLI supports uploading and verifying all standard file types. See the detailed [Files documentation](../files/files.md) for a comprehensive list of supported data formats and sizes.

## Additional Commands

For a full list of available commands and their sub-options, you can always use the standard `--help` flag:

```bash
klein --help
```
