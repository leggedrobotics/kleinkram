# Write Custom Action Templates

Custom Kleinkram Actions Templates allow you to extend the platform's functionality by defining your own data
processing, validation, or analysis workflows. All Kleinkram actions run inside Docker containers, providing a flexible
and isolated environment for your custom logic.

Inside the container, you interact with the Kleinkram platform in exactly the same way as you would from your local
machine, e.g., by using the Python SDK or the `kleinkram` CLI. Kleinkram actions can be authenticated via API keys, and
have access to the mission data they are executed on.

::: tip Next Steps and Further Reading

- For detailed examples and code snippets on how to implement custom actions, please refer to the
  [Custom Action Examples](examples.md) guide.
- For information on how to launch and manage actions via the Kleinkram web interface, please refer
  to the [Using Kleinkram Actions](use-actions.md) guide.
  :::

## Action Execution Environment

Actions run in isolated Docker containers, this ensures security and reproducibility. Actions can be built using any
base image, as long as they meet the requirements for interacting with the Kleinkram platform.

::: warning Docker Image Accessibility
Make sure that your Docker image containing the action code is either publicly accessible (e.g., on Docker Hub) or that
your Kleinkram instance is configured to access your private registry. See
the [Push Actions to Docker Hub](#push-actions-to-docker-hub) section for more details.
:::

### Storage and Memory Model

As Kleinkram is using Docker containers for running actions. By default, all files created inside a Docker container
are discarded as soon as the action completes.

::: tip Layered Filesystem used By Docker
Docker uses a layered filesystem, where the base image layers are read-only, and
all files created inside a container are stored on a writable container layer that sits on top of the read-only,
immutable image layers. [-> Docker Documentation](https://docs.docker.com/engine/storage/#container-layer-basics).
:::

#### Persisting Data Beyond Action Lifetime

To persist data beyond the lifetime of the action, Kleinkram provides two approaches:

1. **Re-Upload Files to a Mission**: You can re-upload files to any mission within the same project using the
   `kleinkram upload` command from within your action. You may also use the Python SDK for this purpose. Kleinkram
   actions have access to all missions within the same project.

    ::: warning Access Rights
    Make sure that the action has the necessary access rights to upload files to the target mission. The action
    needs at least "Write" access to re-upload files.
    :::

2. You can write files to the special `/out` directory inside the container. All files written to this directory
   are automatically uploaded as artifacts to the current action execution after the action completes.

#### Temporary Storage During Action Execution

Files created in the writeable container layer are stored in memory and may count towards the container's memory limit.
To avoid exceeding the memory limit, you can use the `/tmp_disk` directory for local temporary storage. This directory
is backed by disk storage on the host machine and does not count towards the container's memory limit

### Action Limitations

Actions have certain limitations to for resource management, scheduling, and security purposes:

| Limitation              | Description                                                                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Execution Time          | Actions have a maximum runtime.                                                                                                                                                           |
| Memory Limits           | Actions are allocated a specific memory quota.                                                                                                                                            |
| GPU Acceleration        | GPU acceleration is available via [NVIDIA Docker Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/index.html).                                           |
| Access Scoping          | Actions are confined to the project they are executed within.                                                                                                                             |
| Network Isolation       | In production, actions run on an isolated bridge network namespace. They cannot access host loopback services or other private compose networks, and can only access the public internet. |
| Dropped Capabilities    | All default Linux capabilities are dropped (`CapDrop = ['ALL']`). Actions cannot execute low-level host kernel operations.                                                                |
| No Privilege Escalation | Enforces `no-new-privileges`, preventing container processes from gaining elevated permissions via `setuid` or `setgid` binaries.                                                         |

### Action Outcome

Every finished action carries two independent pieces of information.

| Field        | Answers                         | Values                                         |
| ------------ | ------------------------------- | ---------------------------------------------- |
| **State**    | Did the run reach the end?      | `DONE`, `FAILED`, `CANCELLED`, `UNPROCESSABLE` |
| **Severity** | What did it find along the way? | `OK`, `WARNING`, `ERROR`                       |

Keeping these apart matters: an action that completes its work and finds three bags with a missing `/tf` topic did not
fail. It is `DONE` with severity `WARNING`, and Kleinkram shows it as such, in amber rather than red or green.

| State       | Severity  | Shown as                  | Means                                                  |
| ----------- | --------- | ------------------------- | ------------------------------------------------------ |
| `DONE`      | `OK`      | green "DONE"              | Exited 0, reported nothing.                            |
| `DONE`      | `WARNING` | amber "DONE · N findings" | Exited 0, reported warnings.                           |
| `DONE`      | `ERROR`   | red "DONE · N findings"   | Exited 0, but reported an error — a swallowed failure. |
| `FAILED`    | `ERROR`   | red "FAILED"              | Exited non-zero.                                       |
| `CANCELLED` | `OK`      | grey "CANCELLED"          | Someone stopped the run.                               |

#### Raising Warnings

The recommended way to raise a warning is the `klein action` command, because a warning is a message, not a number:

```bash
klein action warn "no /tf topic in this recording" --file run_1.bag --code MISSING_TF
```

Warnings appear on the action while it is still running, so a long action can report as it goes. They survive even if
the container is later killed for exceeding its memory limit, which is exactly the run whose findings you most want to
keep.

| Command             | Severity  | Effect on the action                                                              |
| ------------------- | --------- | --------------------------------------------------------------------------------- |
| `klein action warn` | `WARNING` | Raises the action to `WARNING`. Does not fail the run.                            |
| `klein action fail` | `ERROR`   | Raises the action to `ERROR`. Does **not** stop the run — exit non-zero for that. |
| `klein action info` | `INFO`    | Records a note. Leaves the action reading as clean.                               |

All three accept the same options:

| Option      | Description                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------- |
| `--code`    | A stable identifier such as `MISSING_TF`. Repeated findings with the same code group together.     |
| `--file`    | The file, path or topic the finding is about. Free text — it does not have to be a Kleinkram file. |
| `--details` | A JSON object with extra context.                                                                  |

From Python, the same thing through the SDK:

```python
import kleinkram

for bag in bags:
    if "/tf" not in bag.topics:
        kleinkram.warn("no /tf topic in this recording", file=bag.name, code="MISSING_TF")
```

::: tip Reporting never fails your action
If Kleinkram cannot be reached, `klein action warn` writes to stderr and exits 0. A hiccup while reporting a warning
will never turn a passing action into a failing one.
:::

::: warning Diagnostics are capped
Kleinkram keeps at most 500 distinct findings per action. Identical findings are folded into one entry with a count, so
a loop that warns about the same thing on every file stays readable. Past the cap the action is marked as truncated and
later findings are dropped, though the severity is still raised.
:::

#### Exit Codes

The state of an action comes from the exit code of its container. Kleinkram captures the exact code for debugging.

| Exit Code | State  | Severity  | Description                                               |
| --------- | ------ | --------- | --------------------------------------------------------- |
| `0`       | DONE   | `OK`      | Action completed successfully.                            |
| `75`      | DONE   | `WARNING` | Action completed with warnings. Reserved by Kleinkram.    |
|           |        |           |                                                           |
| `!= 0`    | FAILED | `ERROR`   | Action encountered an error during execution.             |
|           |        |           |                                                           |
| `125`     | FAILED | `ERROR`   | Docker run command failed.                                |
| `126`     | FAILED | `ERROR`   | Command cannot be invoked (Permission denied).            |
| `127`     | FAILED | `ERROR`   | Command not found.                                        |
| `137`     | FAILED | `ERROR`   | Container killed (SIGKILL). Exceeded memory or CPU limit. |
| `139`     | FAILED | `ERROR`   | Container crashed (SIGSEGV). Invalid memory access.       |
| `143`     | FAILED | `ERROR`   | Container stopped (SIGTERM). Time limit approached.       |

::: warning Exit code 75 is reserved
Exit code `75` (`EX_TEMPFAIL` from `sysexits.h`) means "completed with warnings". If a tool in your image happens to
return 75 for an unrelated reason, your action will be shown as warned. Prefer `klein action warn`, which carries a
message and does not depend on your exit code at all; use `exit 75` only when installing the Kleinkram CLI in your image
is not practical.
:::

::: tip Manually Failing an Action
You can use this to signal failure if your validation or processing encounters an error. For example, in a bash script:

```bash
if [ "$some_check" = "fail" ]; then
  echo "Validation failed!"
  exit 1 # Marks action as FAILED
fi
```

:::

A complete validation action that warns without failing:

```bash
#!/bin/bash
set -e

warnings=0
for bag in /data/*.bag; do
  if ! rosbag info "$bag" | grep -q '/tf'; then
    klein action warn "no /tf topic" --file "$(basename "$bag")" --code MISSING_TF
    warnings=$((warnings + 1))
  fi
done

echo "checked with $warnings warnings"
exit 0   # the action succeeded; the warnings speak for themselves
```

#### Who Failed: You or Kleinkram

A failed action also records who is responsible, so you can tell a problem in your action from a problem on our side.

| Failed by | Meaning                                                                                              | What to do                                         |
| --------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `USER`    | Your script exited non-zero, crashed, or ran past the limits configured on its template.             | Fix the action or its template.                    |
| `SYSTEM`  | Kleinkram could not run the action: a runner restart, a scheduling failure, an infrastructure error. | Retry. If it persists, contact your administrator. |

An action failed by `SYSTEM` is shown as "FAILED · system" and is safe to simply run again.

#### Reading the Outcome

In the web interface, the action detail page shows the state, the reason, and a **What this action reported** panel
listing every finding, grouped by message.

From the CLI:

```bash
# the status column shows e.g. "DONE (3 warnings)"
klein execution list --mission <mission>

# state, cause, who failed it, and how many findings
klein execution info <execution-id>

# every finding the action reported
klein execution diagnostics <execution-id>
```

## Container Termination

In some cases, the system may forcefully terminate your action container. This typically results in an exit code of
`137` (SIGKILL) or `143` (SIGTERM). Common reasons include:

- **Time Limit Exceeded**: The action ran longer than the configured `max_runtime` (default: 2 hours).
- **Resource Limits**: The container consumed more memory or CPU than allocated (OOMKilled).
- **Scheduler Interruption**: If the Action Runner service is updated or restarted, it may terminate containers running
  from previous instances to ensure system consistency. This is reported with the status cause "Interrupted by new
  Runner Instance".

:::tip
If you see "Interrupted by new Runner Instance", simply retry the action later. If the issue persists, contact your
administrator.
:::

## Environment Variables

The following environment variables are available within the Docker container during action execution:

| Environment Variable     | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `KLEINKRAM_API_KEY`      | API key for Kleinkram API authentication         |
| `KLEINKRAM_PROJECT_UUID` | UUID of the project the action is running within |
| `KLEINKRAM_MISSION_UUID` | UUID of the mission the action is                |
| `KLEINKRAM_ACTION_UUID`  | UUID of the currently running action             |
| `KLEINKRAM_API_ENDPOINT` | Endpoint of the Kleinkram API                    |
| `KLEINKRAM_S3_ENDPOINT`  | Endpoint of the Kleinkram S3 storage             |

## Push Actions to Docker Hub

Kleinkram actions run inside Docker containers. For the Kleinkram platform to be able to pull and run your action, the
Docker image must be hosted on a public registry like Docker Hub. This ensures that the image is accessible to the
worker nodes executing the actions.

::: details Restricting Allowed Registries (For Administrators)
Administrators can restrict which Docker registries or namespaces are allowed for actions. This is configured via
environment variables. See the [Developer Configuration](/development/getting-started.md#configuration) for more
details.
:::

To publish your action:

```bash
# login to docker hub
docker login

# build the image
docker build -t <namespace>/my-action .

# push the image
docker push <namespace>/my-action
```
