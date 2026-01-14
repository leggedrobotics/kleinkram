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
immutable image layers. For more details visit
the [Docker Documentation](https://docs.docker.com/engine/storage/#container-layer-basics).
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

Actions have certain limitations to for resource management and scheduling purposes:

| Limitation       | Description                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Execution Time   | Actions have a maximum runtime.                                                                                                                 |
| Memory Limits    | Actions are allocated a specific memory quota.                                                                                                  |
| GPU Acceleration | GPU acceleration is available via [NVIDIA Docker Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/index.html). |
| Access Scoping   | Actions are confined to the project they are executed within.                                                                                   |

### Action Status (Exit Codes)

The status of an action execution is determined by the exit code of the Docker container. Some exit codes have special
meanings and are used internally by Kleinkram. Kleinkram captures the exact exit code for debugging purposes.

| Exit Code | Action Status | Description                                               |
| --------- | ------------- | --------------------------------------------------------- |
| `0`       | DONE          | Action completed successfully.                            |
|           |               |                                                           |
| `!= 0`    | FAILED        | Action encountered an error during execution.             |
|           |               |                                                           |
| `125`     | FAILED        | Docker run command failed.                                |
| `126`     | FAILED        | Command cannot be invoked (Permission denied).            |
| `127`     | FAILED        | Command not found.                                        |
| `137`     | FAILED        | Container killed (SIGKILL). Exceeded memory or CPU limit. |
| `139`     | FAILED        | Container crashed (SIGSEGV). Invalid memory access.       |
| `143`     | FAILED        | Container stopped (SIGTERM). Time limit approached.       |

::: tip Manually Failing an Action
You can use this to signal failure if your validation or processing encounters an error. For example, in a bash script:

```bash
if [ "$some_check" = "fail" ]; then
  echo "Validation failed!"
  exit 1 # Marks action as FAILED
fi
```

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
