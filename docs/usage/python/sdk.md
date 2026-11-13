# Python SDK Reference

Installing `kleinkram` using `pip` installs both the CLI and a Python package. The `kleinkram` Python package provides programmatic access to Kleinkram, mirroring most of the CLI's capabilities.

::: tip Summary

| Task                      | Functions                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| Find data                 | `list_projects`, `list_missions`, `list_files`, `get_project`, `get_mission`, `get_file`          |
| Move data                 | `upload`, `download` (also [part of an `.mcap`](#downloading-part-of-a-recording)), `verify`      |
| Create, change and delete | `create_project`, `create_mission`, `update_project`, `update_mission`, `delete_*`                |
| Actions                   | `*_template*`, `launch_execution`, `run_script`, `*_execution`, `download_artifact`, `*_trigger*` |
| Inside an action          | `warn`, `fail`, `info`, `list_diagnostics`                                                        |

Every function is imported from `kleinkram` and accepts an optional `client=` keyword argument (see below).
:::

## Authentication

The SDK uses the login of the CLI. Log in once on the machine:

```bash
klein login https://datasets.example.org
```

The SDK then reads the saved credentials and the active server from `~/.kleinkram.json`, and refreshes the login
when it expires. See [Authentication](./setup.md#authentication) for headless machines and other providers, and
[Servers](./setup.md#servers) to talk to another Kleinkram instance. Inside a Kleinkram
action, the SDK is already authenticated, like the CLI.

If you are not logged in, every call raises `kleinkram.errors.NotAuthenticated`.

### Reusing a Client

Each call creates its own HTTP client unless you pass one. To make many calls, create one client and pass it as
`client=`, so the connection and the login are reused:

```python
import kleinkram
from kleinkram.api.client import AuthenticatedClient

client = AuthenticatedClient()
for mission in kleinkram.list_missions(project_names=["testProject"], client=client):
    files = kleinkram.list_files(mission_ids=[mission.id], client=client)
```

`AuthenticatedClient(config_path=...)` reads the endpoint and credentials from another file than `~/.kleinkram.json`.

## Core Usage

You can import all available functions directly from the `kleinkram` package.

```python
import kleinkram
```

### Listing Resources

Retrieve lists of your projects, missions, and files based on specific query parameters.

```python
# List all projects matching a name pattern
projects = kleinkram.list_projects(project_names=["testProject"])

# List missions within specific projects
missions = kleinkram.list_missions(
    project_names=["testProject"],
    mission_names=["testMission"]
)

# List files within specific missions
files = kleinkram.list_files(
    project_names=["testProject"],
    mission_names=["testMission"],
    file_names=["*.bag"]
)

# List the action triggers of a mission
triggers = kleinkram.list_triggers(mission_uuid="...")
```

### Downloading Part of a Recording

`download` takes the same MCAP filters as the CLI. Passing any of them fetches
only the selected messages (or, for compressed chunks, the chunks holding them)
and skips files that are not `.mcap`. `start_time` is inclusive, `end_time`
exclusive.

```python
kleinkram.download(
    file_ids=["38d7e53e-64d6-434e-a21a-f02017dc6290"],
    dest="./slice",
    topics=["/imu/data_raw"],
    start_time=1789718908373212789,   # nanoseconds, as in MCAP log times
    end_time=1789718918373212789,
)
```

See [Partial Download](../files/partial-download.md) for what actually saves
bandwidth.

### Getting Resources by ID

If you already know the unique identifier for a resource, you can fetch it directly.

```python
project = kleinkram.get_project(project_id="...")
mission = kleinkram.get_mission(mission_id="...")
file = kleinkram.get_file(file_id="...")
trigger = kleinkram.get_trigger("...")
```

`get_trigger` returns the trigger's full configuration, so it needs `Read`
access on the trigger's mission — or you have to have created the trigger
yourself. See [Action and Action Template](../access-control/action.md) for the
access rules, in particular the caveat on webhook trigger uuids.

### Creating Resources

Programmatically set up your workspace by creating new projects and missions. Names must follow the [naming rules](../getting-started.md#naming-rules).

```python
# Create a new project
kleinkram.create_project(
    project_name="new-project",
    description="My new project description"
)

# Create a mission within a specific project
kleinkram.create_mission(
    mission_name="new-mission",
    project_id="...",
    metadata={"sensor": "lidar"}
)
```

### File Transfer (Upload/Download)

Transfer data locally via Python scripts.

```python
# Upload files to a specific mission
kleinkram.upload(
    project_name="testProject",
    mission_name="testMission",
    files=["data.bag", "metadata.yaml"],
    create=True  # Automatically create the mission if it doesn't exist
)

# Download files from a specific mission
# Note: The destination directory (`dest`) must already exist before downloading.
kleinkram.download(
    project_name="testProject",
    mission_name="testMission",
    dest="./downloaded_data",
    nested=True # Organizes files into dest/project-name/mission-name subdirectories
)
```

### Verifying Files

Check the verification status of your uploaded files.

```python
# Verify if files were successfully uploaded and processed
status = kleinkram.verify(
    project_name="testProject",
    mission_name="testMission",
    files=["data.bag"]
)
```

### Checking the Result of a Transfer

Like the CLI, `upload`, `download` and `verify` handle every file and report problems per file instead of raising on
the first one. Check what they return:

```python
from kleinkram.api.file_transfer import DOWNLOAD_STATES_NOT_DONE
from kleinkram.models import FileVerificationStatus

result = kleinkram.upload(project_name="testProject", mission_name="testMission", files=["data.bag"])
# conflicts: the name is taken in the mission by a file with different content
# unchecked: the name is taken, and the content could not be compared yet
not_uploaded = result.failed + len(result.conflicts) + len(result.unchecked)

result = kleinkram.download(project_name="testProject", mission_name="testMission", dest="./data")
# skipped files, e.g. a local file with the same name but different content, count as not downloaded
not_downloaded = result.failed + sum(result.state_counts.get(s, 0) for s in DOWNLOAD_STATES_NOT_DONE)

status = kleinkram.verify(project_name="testProject", mission_name="testMission", files=["data.bag"])
not_verified = [path for path, s in status.items() if s != FileVerificationStatus.UPLOADED]
```

These are the same checks that decide the [exit code](./cli.md#exit-codes) of the CLI.

`verify` returns a status per local file: `uploaded`, `uploading`, `computing hash`, `missing`, `hash mismatch`,
`size mismatch` or `unknown`. On Ctrl+C, `upload` and `download` raise `KeyboardInterrupt`;
`kleinkram.errors.get_transfer_result(exc)` returns what finished before.

### Updating Resources

Modify the metadata and descriptions of existing resources.

```python
# Update a project's description
kleinkram.update_project(project_id="...", description="Updated Description")

# Update a mission's metadata
kleinkram.update_mission(mission_id="...", metadata={"status": "completed"})
```

### Kleinkram Actions

The SDK covers the same action workflows as the `template`, `execution` and `trigger` commands of the CLI. Templates
can be given by ID or, where noted, by name.

```python
import kleinkram

# templates
templates = kleinkram.list_templates()                   # latest version of each; latest_only=False for all
template = kleinkram.get_template(template_id="...")
revisions = kleinkram.get_template_revisions(template_id="...")

template_id = kleinkram.create_template(
    name="my-action",
    description="Extracts metadata",
    docker_image="rslethz/action:extract-metadata-latest",
    cpu_cores=1,
    cpu_memory_gb=2,
    gpu_memory_gb=-1,          # -1: no GPU
    max_runtime_minutes=60,
    access_rights=0,           # 0 read, 10 create, 20 modify, 30 delete
)
new_version_id = kleinkram.create_template_version(template_id, cpu_memory_gb=4)  # only the values you pass change
archived = kleinkram.delete_template(template_id)  # True if it was archived because it has executions

# executions; the template can be a name or an ID
execution_id = kleinkram.launch_execution("my-action", project_name="testProject", mission_name="testMission")
execution = kleinkram.get_execution(execution_id)
executions = kleinkram.list_executions(mission_uuid="...")      # also project_uuid=, template_name=
path = kleinkram.download_artifact(execution_id, output_dir="./artifacts", extract=True)
kleinkram.delete_execution(execution_id)

# run a single Python file, see "Run a Single Python File"
execution_id = kleinkram.run_script("./analyse.py", project_name="testProject", mission_name="testMission")
```

`launch_execution` and `run_script` take the mission as `mission_id=`, or as `mission_name=` together with
`project_name=` or `project_id=`.

Triggers take a configuration object that matches their type:

```python
import kleinkram
from kleinkram.models import FileConfig, FileTriggerEvent, TimeConfig, TriggerType, WebhookConfig

trigger_id = kleinkram.create_trigger(
    "on-upload",
    template_uuid="...",
    mission_uuid="...",
    type_=TriggerType.FILE,
    config=FileConfig(patterns=("*.bag",), event=(FileTriggerEvent.UPLOAD,)),
)
# other types: TriggerType.TIME with TimeConfig(cron="0 0 * * *"), TriggerType.WEBHOOK with WebhookConfig()

# to change the configuration, pass both type_ and config
kleinkram.update_trigger(
    trigger_id,
    type_=TriggerType.FILE,
    config=FileConfig(patterns=("*.mcap",), event=(FileTriggerEvent.UPLOAD,)),
)
kleinkram.delete_trigger(trigger_id)
```

### Reporting from Inside an Action

When your code runs inside a Kleinkram action, it can report what it found. Warnings do not fail the action: the run
still completes, and is shown as done with warnings.

```python
import kleinkram

for bag in bags:
    if "/tf" not in bag.topics:
        kleinkram.warn("no /tf topic in this recording", file=bag.name, code="MISSING_TF")

# record an error without stopping the run; exit non-zero to fail the action itself
kleinkram.fail("bag header is truncated", file="run_2.bag")

# a note that leaves the action reading as clean
kleinkram.info("checked 42 recordings")
```

These read `KLEINKRAM_ACTION_UUID` from the environment, so they raise `NotInsideAction` when called outside an action
container. Pass `execution_id=` explicitly if you need to target a specific run.

Read them back with `kleinkram.list_diagnostics(execution_id)`.

### Deleting Resources

Clean up your workspace by programmatically deleting files, missions, or projects.

```python
# Delete a single file
kleinkram.delete_file(file_id="...")

# Delete multiple files simultaneously
kleinkram.delete_files(file_ids=["id_1", "id_2"])

# Delete an entire mission
kleinkram.delete_mission(mission_id="...")

# Delete an entire project
kleinkram.delete_project(project_id="...")
```
