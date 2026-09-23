# Command-Line Interface (CLI)

Ensure you have installed the Kleinkram CLI and authenticated as described in the [Setup Guide](./setup.md).

## Getting Started

Here is a quick example of a common automated workflow: creating a project, uploading data, and launching a Kleinkram action.

```bash
# 1. Create a Project and Mission
klein project create testProject --description "Just a Test Project for running actions"
echo "123" > test.yml
klein upload --project testProject --mission testMission --create test.yml

# 2. List Existing Kleinkram Action Templates
klein template list

# 3. Launch an action (assuming an action template named "extract-metadata" exists)
klein execution launch extract-metadata --project testProject --mission testMission --follow
```

## How Arguments Work

All commands follow the same conventions:

- **The thing a command acts on is a positional argument**, for example the mission in `klein mission info <mission>`
  or the files in `klein upload <files>...`.
- **The scope is given with flags.** A mission always belongs to a project, so `--project` (`-p`) narrows down
  which mission you mean, and `--mission` (`-m`) narrows down which file you mean.
- **Projects, missions and templates can be given by name or by ID.** Wherever a command expects one, both work.
- **Deleting asks for confirmation.** Pass `--yes` (`-y`) to skip the prompt, e.g. in scripts. In a
  non-interactive session (no terminal attached), `--yes` is required.
- **Short flags always mean the same thing:** `-p` is the project, `-m` the mission, `-y` confirms, `-f` follows
  logs and `-h` shows the help of any command.

```bash
klein mission info testMission -p testProject
klein file delete data.bag -p testProject -m testMission --yes
```

## Core Workflows

### Listing Resources

Every resource has a `list` command. The positional arguments filter by name, ID or glob pattern.

```bash
# List all projects your user has access to
klein project list

# List all missions within a specific project
klein mission list --project testProject

# List all files currently inside a mission
klein file list --project testProject --mission testMission

# List all bag files of every mission whose name starts with "2024"
klein file list --mission "2024*" "*.bag"
```

### Downloading Part of a Recording

`.mcap` files carry an index, so the CLI can fetch only the messages you ask for
instead of the whole file:

```bash
klein download --dest ./slice --topics /rosout \
  --start-time 2026-09-18T08:08:28Z --end-time 2026-09-18T08:08:38Z <file>
```

For recordings with uncompressed chunks both `--topics` and the time window cut
the transfer; with compressed chunks only the time window does. See
[Partial Download](../files/partial-download.md) for the numbers and the
caveats.

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

### Managing Projects, Missions and Files

```bash
klein project create testProject --description "Data of the test robot"
klein project info testProject
klein project update testProject --name renamedProject --description "New description"
klein project delete renamedProject

klein mission create testMission --project testProject --metadata metadata.yaml
klein mission info testMission --project testProject
klein mission update testMission --project testProject --metadata metadata.yaml
klein mission delete testMission --project testProject

klein file info data.bag --project testProject --mission testMission
klein file delete data.bag other.bag --project testProject --mission testMission
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

### Kleinkram Actions

Action templates, their executions and triggers are managed with the `template`, `execution` and `trigger` commands.
See [Use Kleinkram Actions](../actions/use-actions.md) for the concepts behind them.

```bash
# templates, given by name (latest version) or ID
klein template list
klein template create my-action --description "Extracts metadata" --docker-image rslethz/action:extract-metadata-latest
klein template revisions my-action
klein template create-version my-action --cpu-memory 4

# executions
klein execution launch my-action --project testProject --mission testMission
klein execution list --mission testMission --project testProject  # status shows e.g. "DONE (3 warnings)"
klein execution info <EXECUTION_ID>         # state, cause and number of findings
klein execution diagnostics <EXECUTION_ID>  # every warning and error the action reported
klein execution logs <EXECUTION_ID> --follow
klein execution download <EXECUTION_ID> --output-dir ./artifacts --extract

# triggers
klein trigger create on-upload --template my-action --project testProject --mission testMission \
    --type FILE --file-patterns "*.bag" --file-events UPLOAD
klein trigger list --project testProject --mission testMission
klein trigger delete <TRIGGER_UUID>
```

## Supported File Types

The Kleinkram CLI supports uploading and verifying all standard file types. See the detailed [Files documentation](../files/files.md) for a comprehensive list of supported data formats and sizes.

## Deprecated Syntax

Earlier versions of the CLI were less consistent about which values are positional arguments and which are flags.
The old syntax still works but prints a warning, and it will be removed in version 1.0.0. Update your scripts as
follows:

| Deprecated                                                          | Replacement                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `klein templates ...`, `klein executions ...`, `klein triggers ...` | `klein template ...`, `klein execution ...`, `klein trigger ...` |
| `klein list projects / missions / files ...`                        | `klein project list`, `klein mission list`, `klein file list`    |
| `klein project create/info/update/delete -p <project>`              | `klein project create/info/update/delete <project>`              |
| `klein project update ... --new-name <name>`                        | `klein project update ... --name <name>`                         |
| `klein mission create/info/update/delete -m <mission>`              | `klein mission create/info/update/delete <mission>`              |
| `klein file info/delete -f <file>`                                  | `klein file info/delete <file>`                                  |
| `--confirm` on `mission delete` / `file delete`                     | `--yes` / `-y`                                                   |
| `klein executions launch <template> <mission>`                      | `klein execution launch <template> -m <mission>`                 |
| `klein executions list --project-uuid / --mission-uuid`             | `klein execution list --project / --mission` (name or ID)        |
| `klein executions list --template-name`                             | `klein execution list --template` / `-t`                         |
| `klein executions download -f <filename>`                           | `klein execution download --filename <filename>`                 |
| `klein templates create --name <name>` / `-n`                       | `klein template create <name>`                                   |
| `klein templates create/create-version -m <gb>`                     | `klein template create/create-version --cpu-memory <gb>`         |
| `klein triggers create --name <name>` / `-n`                        | `klein trigger create <name>`                                    |
| `klein triggers create/update -y <type>`                            | `klein trigger create/update --type <type>`                      |
| `klein login -p <provider>`                                         | `klein login --oauth-provider <provider>`                        |
| `klein verify --skip-hash`                                          | `klein verify --no-check-file-hash`                              |

Deleting a project, template, execution or trigger without `--yes` in a non-interactive session still works for now
(with a warning) but will fail from version 1.0.0 on.

## Additional Commands

For a full list of available commands and their sub-options, you can always use the standard `--help` flag:

```bash
klein --help
klein mission --help
klein mission info --help
```
