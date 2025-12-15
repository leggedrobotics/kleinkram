# How to Write Custom Actions

Custom Kleinkram actions are implemented as Docker containers. Inside the container, you interact with the Kleinkram platform using the Kleinkram CLI. The [Kleinkram CLI](/usage/python/setup.md) is a Python package installable via `pip`.

## Under the Hood

Actions run in isolated Docker containers. This ensures security and reproducibility.

### Storage, Disk Space, and Memory

By default, files within a Kleinkram action reside in the container's memory, contributing to its memory limit.

All data within the action's container is temporary and deleted upon completion. To persist data as artifacts, store them in the `/out` directory.

::: tip Use `/tmp_disk` for Large Datasets
To manage larger datasets or avoid memory limitations, utilize the `/tmp_disk` directory. This directory is a mounted volume from the host's disk, and files stored here do not impact the action's memory usage.
:::

### Action Limitations

- **Execution Time Limits:** Actions have a maximum runtime. Configurable via the web interface.
- **Memory Limits:** Actions are allocated a specific memory quota. Configurable via the web interface.
- **GPU Support:** GPU acceleration is available via [NVIDIA Docker Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/index.html), requested during action submission.
- **Access Scoping:** Actions are confined to the project they are executed within.

### Action Status (Exit Codes)

The status of an action execution is determined by the exit code of the Docker container:

- **Exit Code 0**: The action is marked as **DONE** (Success).
- **Non-Zero Exit Code**: The action is marked as **FAILED**.

You can use this to signal failure if your validation or processing encounters an error. For example, in a bash script:

```bash
if [ "$some_check" = "fail" ]; then
  echo "Validation failed!"
  exit 1 # Marks action as FAILED
fi
```

## Examples

Here are some examples of how to implement custom actions.

### CLI Example: Validate Data

This example uses a bash script to calculate SHA256 checksums of all files in a mission. It demonstrates how to use the Kleinkram CLI directly.

**Dockerfile**

```Dockerfile [Dockerfile]
FROM python:3.9-slim

# Install Kleinkram CLI
RUN pip install kleinkram

# Copy entrypoint script and make it executable
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

**entrypoint.sh**

```bash [entrypoint.sh]
#!/bin/bash
set -e

echo "Validating data for mission $KLEINKRAM_MISSION_UUID"

# Authenticate
klein login --key "$KLEINKRAM_API_KEY"

# Download data
mkdir /data
klein download -m "$KLEINKRAM_MISSION_UUID" --dest /data

# Calculate hashes
cd /data
find . -type f -exec sha256sum {} \; > /out/checksums.txt

echo "Validation complete. Checksums saved to checksums.txt"
```

### Python Example: Python Template

This example demonstrates how to use the Python SDK to interact with Kleinkram. It is recommended for complex logic.

**Dockerfile**

```Dockerfile [Dockerfile]
FROM python:3.9-slim

# Install Kleinkram CLI
RUN pip install kleinkram

# Install user requirements
COPY requirements.txt /requirements.txt
RUN pip install -r /requirements.txt

# Copy scripts
COPY ./main.py /main.py

ENTRYPOINT ["python3", "/main.py"]
```

**main.py**

```python [main.py]
import os
import kleinkram

def main():
    # 1. Authenticate
    # The client automatically picks up authentication from environment variables
    # (KLEINKRAM_API_KEY, KLEINKRAM_API_ENDPOINT)

    # 2. Download data
    mission_uuid = os.environ.get("KLEINKRAM_MISSION_UUID")
    print(f"Downloading data for mission {mission_uuid}...")

    download_dir = "/data"
    os.makedirs(download_dir, exist_ok=True)

    kleinkram.download(mission_ids=[mission_uuid], dest=download_dir)

    # 3. Process data
    # ... your processing logic here ...
    print("Processing complete.")

if __name__ == "__main__":
    main()
```

## Environment Variables

The following environment variables are available within the Docker container during action execution:

- `KLEINKRAM_API_KEY`: API key for Kleinkram API authentication.
- `KLEINKRAM_PROJECT_UUID`: UUID of the project the action is running within.
- `KLEINKRAM_MISSION_UUID`: UUID of the mission the action is operating on.
- `KLEINKRAM_ACTION_UUID`: UUID of the currently running action.
- `KLEINKRAM_API_ENDPOINT`: Endpoint of the Kleinkram API.
- `KLEINKRAM_S3_ENDPOINT`: Endpoint of the Kleinkram S3 storage.

## Push Actions to Docker Hub

Kleinkram actions run inside Docker containers. For the Kleinkram platform to be able to pull and run your action, the Docker image must be hosted on a public registry like Docker Hub. This ensures that the image is accessible to the worker nodes executing the actions.

::: details Restricting Allowed Registries (For Administrators)
Administrators can restrict which Docker registries or namespaces are allowed for actions. This is configured via environment variables. See the [Developer Configuration](/development/getting-started.md#configuration) for more details.
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

## Using the CLI in Actions

The `kleinkram` CLI is the primary way to interact with the platform from within an action. It provides commands to download data, upload artifacts, and more.

### Python Bindings

For Python actions, it is recommended to use the Python bindings instead of calling the CLI via `subprocess`. This provides a more robust and pythonic way to interact with the API.

```python
import os
import kleinkram

# Download data
# The client automatically picks up authentication from environment variables
# (KLEINKRAM_API_KEY, KLEINKRAM_API_ENDPOINT)
mission_uuid = os.environ.get("KLEINKRAM_MISSION_UUID")
kleinkram.download(mission_ids=[mission_uuid], dest="/data")

# Upload artifact (if needed explicitly, though /out is auto-uploaded)
kleinkram.upload(...)
```

### CLI Commands

For a full list of available commands, see the [CLI Documentation](../python/cli.md).

Here are the most common commands used within actions:

```bash
# Authenticate
klein login --key <API_KEY>

# Download all files from a mission
klein download -m <MISSION_UUID> --dest <DIR>

# List files in a mission
klein list files -m <MISSION_UUID>
```
