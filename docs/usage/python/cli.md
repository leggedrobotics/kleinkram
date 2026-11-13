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
- **Options can go before or after the files.** `klein upload -p p -m m data.mcap` and
  `klein upload data.mcap -p p -m m` do the same. To pass a file whose name starts with `-`, put `--` before it:
  everything after `--` is a file, e.g. `klein upload -p p -m m --fix-filenames -- -weird-name.mcap` (a name in a
  mission must not start with `-`, so `--fix-filenames` uploads it as `_weird-name.mcap`).
- **The scope is given with flags.** A mission always belongs to a project, so `--project` (`-p`) narrows down
  which mission you mean, and `--mission` (`-m`) narrows down which file you mean.
- **Projects, missions and templates can be given by name or by ID.** Wherever a command expects one, both work.
- **Deleting asks for confirmation.** Pass `--yes` (`-y`) to skip the prompt, e.g. in scripts. In a
  non-interactive session (no terminal attached), `--yes` is required.
- **Short flags mean the same thing across commands:** `-p` is the project, `-m` the mission, `-y` confirms, `-f`
  follows logs and `-h` shows the help of any command. See below for the exceptions.

```bash
klein mission info testMission -p testProject
klein file delete data.bag -p testProject -m testMission --yes
```

::: warning Exceptions to the short flags
A few short flags still mean something else on some commands. The deprecated ones print a warning and are removed in
version 1.0.0; use the long option instead.

| Short flag | Usual meaning                      | Other meaning                                                            | Status     |
| ---------- | ---------------------------------- | ------------------------------------------------------------------------ | ---------- |
| `-r`       | `--recursive` (`upload`, `verify`) | `--max-runtime` on `template create` / `create-version`                  | Current    |
| `-y`       | `--yes`                            | `--type` on `trigger create` / `update`                                  | Deprecated |
| `-f`       | `--follow`                         | the file on `file info` / `delete`, `--filename` on `execution download` | Deprecated |
| `-m`       | `--mission`                        | `--cpu-memory` on `template create` / `create-version`                   | Deprecated |
| `-p`       | `--project`                        | `--oauth-provider` on `login`                                            | Deprecated |

:::

## Global Options

These options go before the command, e.g. `klein --no-verbose file list -m testMission`.

| Option                | Effect                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--no-verbose`        | Output for scripts: `list` commands print one ID per line instead of a table, `info` commands print JSON, `upload` and `download` show no progress bars, and errors are shorter. When listing files, files that are not in the `OK` state are printed to stderr instead of stdout. `upload`, `download` and `verify` still print every problem on stderr, and their exit code does not change (see [Exit Codes](#exit-codes)). |
| `--max-lines <n>`     | Maximum number of rows in a table. `-1` prints all rows.                                                                                                                                                                                                                                                                                                                                                                       |
| `--debug`             | Show the Python traceback when a command fails, and write the log file at `DEBUG` level.                                                                                                                                                                                                                                                                                                                                       |
| `--log-level <level>` | Log level for the log file (`DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`). Each run writes a log file to `~/.local/state/kleinkram/` (on Windows `%LOCALAPPDATA%\kleinkram`).                                                                                                                                                                                                                                               |
| `--version`, `-v`     | Print the CLI version.                                                                                                                                                                                                                                                                                                                                                                                                         |

```bash
# the IDs of all bag files in a mission, for use in a script
klein --no-verbose file list -p testProject -m testMission "*.bag"
```

## Exit Codes

`upload`, `download` and `verify` process every file, report each problem on stderr, and then exit with a code that
says whether everything you asked for happened, like `cp`, `rsync` or `sha256sum -c`. The exit code is the same with
and without `--no-verbose`; that option only changes how much is printed.

| Code  | Meaning                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------- |
| `0`   | Every requested file was handled.                                                                        |
| `1`   | At least one requested file was not uploaded, downloaded or verified; each one is named on stderr.       |
| `2`   | The command line is wrong (unknown option, missing argument).                                            |
| `130` | Interrupted with Ctrl+C. Uploads and downloads that were running are cancelled; finished files are kept. |

What counts as handled:

- **`upload`**: the file is in the mission, either uploaded now or already there with the same content. A file whose
  upload failed, or whose name is taken by a file with different content (or content that cannot be compared yet), is
  not.
- **`download`**: the file is in the destination, either downloaded now or already there with the right hash. Files
  that are skipped because a local file with the same name differs (use `--overwrite`), because the remote file is
  corrupted (use `--include-corrupt-files`) or not in a downloadable state, or that fail the hash check, are not. Non-`.mcap`
  files skipped by `--topics` / `--start-time` / `--end-time` only get a warning.
- **`verify`**: the file is in the mission with the same size and hash. A file that is still being uploaded or
  processed is not verified yet: run `klein verify` again later.

Files left out on purpose with `--skip` do not change the exit code.

```bash
# stop a script if anything did not make it
klein --no-verbose upload -p testProject -m testMission -r ./recordings || exit 1
klein --no-verbose verify -p testProject -m testMission -r ./recordings || exit 1
```

## Servers and Login

| Command                    | What it does                                                                     |
| -------------------------- | -------------------------------------------------------------------------------- |
| `klein login <url>`        | Adds the server behind the web app address `<url>`, makes it active and logs in. |
| `klein login`              | Logs in to the active server again.                                              |
| `klein login --headless`   | Prints the login code instead of opening a browser.                              |
| `klein login --key <key>`  | Stores an API key for the active server (add `<url>` if none is set up yet).     |
| `klein host`               | Lists the saved servers and marks the active one.                                |
| `klein host use <name>`    | Makes a saved server the active one.                                             |
| `klein host remove <name>` | Forgets a server and its login.                                                  |
| `klein logout [--all]`     | Removes the login of the active server (or of all servers).                      |

See the [Setup Guide](./setup.md#authentication) for how the login works.

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

To upload files from subdirectories, pass a directory with `--recursive` (`-r`). The CLI collects every file with a
supported type below it, in any case (`REC.MCAP` too), and ignores everything else (including hidden files and
directories). A file whose name doesn't follow the naming rules stops the upload, unless you add `--fix-filenames` or
`--skip` (see below):

```bash
klein upload --project testProject --mission testMission --recursive ./recordings
```

Or pass a **quoted** `**` pattern, which the CLI expands itself:

```bash
klein upload --project testProject --mission testMission '**/*.mcap'
```

::: warning Quote `**` patterns
Shells handle `**` differently. zsh and fish match files at every depth. bash (without `shopt -s globstar`), sh and
PowerShell on Linux / macOS treat `**` like `*`, so they match only one directory level and silently miss deeper
files. PowerShell and cmd on Windows don't expand wildcards at all. Quoting the pattern, or using `--recursive`, gives
the same result in every shell.
:::

Kleinkram stores files flat in a mission, under their file name only. If two of the selected files have the same
name (e.g. `run1/data.mcap` and `run2/data.mcap`), the upload is refused before anything is sent.

`klein verify` accepts the same directories, `--recursive` and patterns.

To see what an upload would do before running it, add `--dry-run`. It runs the same checks as a real upload and lists
every file with the name it gets in the mission, but uploads nothing and creates no mission:

```bash
klein upload --project testProject --mission testMission --dry-run --recursive ./recordings
```

With `--no-verbose`, the dry run prints one tab-separated line per file instead of the table (`<action>`,
`<local path>`, `<name in mission>`), with the action being one of `upload`, `skip-same`, `skip-different` or
`skip-unchecked`. Backslashes, tabs and line breaks in paths are escaped as `\\`, `\t`, `\n` and `\r`, so every file
stays on one line.

A file whose name is already used in the mission is always skipped, even if its content changed. The dry run compares
the content and marks those files as `skip, name taken by a different file`. A real upload makes the same comparison
afterwards: it lists such files as **NOT uploaded** and exits with code 1 (see [Exit Codes](#exit-codes)), so rename
the local file or delete the file in the mission first.

::: tip Creating Missions on Upload
To create a mission automatically during upload if it doesn't already exist, use the `--create` flag. Note that the target project must already exist.

```bash
klein upload --create --project testProject --mission testMission *.bag
```

:::

The other options of `upload`:

| Option              | Effect                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--metadata <file>` | A JSON or YAML file with the metadata of the mission, as `name: value` pairs. It is only used together with `--create`, when the mission is created; the metadata of an existing mission is not changed. To change it, use `klein mission update --metadata`. |
| `--fix-filenames`   | Upload files whose names Kleinkram does not accept under a fixed name, instead of failing. The local files are not renamed. See below.                                                                                                                        |
| `--skip`, `-s`      | Skip files that cannot be uploaded (unsupported type, bad name, directories) instead of failing, and upload the rest.                                                                                                                                         |

File names follow the [naming rules](../getting-started.md#naming-rules): the part before the extension is 3 to 50
characters of letters, digits, `.`, `_` and `-`, not starting with `.` or `-`, and the extension is lowercase. The CLI
checks them before it uploads anything and says what is wrong. With `--fix-filenames`, files are uploaded under a
valid name instead:

- every other character, and a leading `.` or `-`, is replaced by `_`
- the extension is lowercased: `REC.MCAP` becomes `REC.mcap`
- a name longer than 50 characters is cut to 40 characters followed by 10 characters of a hash of the original name
- a name shorter than 3 characters gets `_` and 4 characters of that hash appended: `a.bag` becomes `a_1fef.bag`

The hash keeps names that start the same apart, and the same file always gets the same name. Use `--dry-run` to see
the names before uploading.

```bash
# "run 1 (left).bag" is uploaded as "run_1__left_.bag"
klein upload --create --metadata mission.yaml --fix-filenames -p testProject -m testMission "run 1 (left).bag"
```

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

A file that already exists in the destination is kept if its hash matches. If it differs, it is skipped and the
command exits with code 1; pass `--overwrite` to replace it. See [Exit Codes](#exit-codes).

### Verifying Resources

Use the `verify` command to double-check if your local files were successfully uploaded and processed by the Kleinkram backend.

```bash
klein verify --project testProject --mission testMission data.bag
```

`verify` doesn't check the naming rules, so files uploaded under an older rule (e.g. `-dash.bag`) can still be
verified. It looks a file up under its local name first, and otherwise under the name `--fix-filenames` would give it.

It exits with code 0 only if every file is in the mission with the same size and hash, and with 1 otherwise (see
[Exit Codes](#exit-codes)). With `--no-verbose`, it prints the verified paths on stdout and every other file as
`<status>: <path>` on stderr, e.g. `hash mismatch: data.bag` or `missing: data.bag`.

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
klein template list                        # --all lists every version, not only the latest
klein template create my-action --description "Extracts metadata" --docker-image rslethz/action:extract-metadata-latest
klein template revisions my-action
klein template create-version my-action --cpu-memory 4
klein template delete my-action            # archived instead if it already has executions

# executions
klein execution launch my-action --project testProject --mission testMission
klein execution list --mission testMission --project testProject  # status shows e.g. "DONE (3 warnings)"
klein execution info <EXECUTION_ID>         # state, cause and number of findings
klein execution diagnostics <EXECUTION_ID>  # every warning and error the action reported
klein execution logs <EXECUTION_ID> --follow
klein execution download <EXECUTION_ID> --output-dir ./artifacts --extract
klein execution cancel <EXECUTION_ID>      # stop a pending or running execution
klein execution delete <EXECUTION_ID>

# triggers
klein trigger create on-upload --template my-action --project testProject --mission testMission \
    --type FILE --file-patterns "*.bag" --file-events UPLOAD
klein trigger create nightly --template my-action -p testProject -m testMission --type TIME --cron "0 0 * * *"
klein trigger create from-ci --template my-action -p testProject -m testMission --type WEBHOOK
klein trigger list --project testProject --mission testMission
klein trigger info <TRIGGER_UUID>
klein trigger update <TRIGGER_UUID> --type FILE --file-patterns "*.mcap" --file-events UPLOAD --file-events MOVE
klein trigger delete <TRIGGER_UUID>
```

`template create` and `create-version` take the resources of the action: `--cpu-cores`, `--cpu-memory` and
`--gpu-memory` (in GB, `-1` for no GPU), `--max-runtime` (in minutes), `--access-rights` (`0` read, `10` create,
`20` modify, `30` delete), and optionally `--command` and `--entrypoint`. `create-version` only changes the values you
pass.

A file trigger takes one or more `--file-patterns` (globs on the file name) and `--file-events` (`UPLOAD`, `RENAME`,
`MOVE`, `DELETE`). A time trigger takes a `--cron` expression. `trigger update` needs `--type` whenever it changes
these values. See [Action Triggers](../actions/triggers.md).

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
| `klein endpoint`, `klein endpoint <name>`                           | `klein host`, `klein host use <name>`                            |
| `klein endpoint <name> <api> <s3>`                                  | `klein login <url>`                                              |
| `klein verify --skip-hash`                                          | `klein verify --no-check-file-hash`                              |
| `--ignore-missing-tags` on `upload` / `mission create`              | Remove it: it has no effect                                      |
| `required_tags` in the JSON of `klein --no-verbose project info`    | `required_metadata_types`                                        |

Deleting a project, template, execution or trigger without `--yes` in a non-interactive session still works for now
(with a warning) but will fail from version 1.0.0 on.

The Python SDK has deprecated names too. They emit a `DeprecationWarning` and are removed in version 1.0.0:

| Deprecated              | Replacement                       |
| ----------------------- | --------------------------------- |
| `Project.required_tags` | `Project.required_metadata_types` |

## Additional Commands

For a full list of available commands and their sub-options, you can always use the standard `--help` flag:

```bash
klein --help
klein mission --help
klein mission info --help
```
