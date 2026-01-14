# Example Action Templates

Kleinkram comes with a set of example actions that cover common use cases:

| Action                | Image Name                               | Description                                                | Input           | Output             |
| :-------------------- | :--------------------------------------- | :--------------------------------------------------------- | :-------------- | :----------------- |
| **Validate Data**     | `rslethz/action:validate-data-latest`    | Calculates SHA256 checksums of all files in a mission.     | Any             | `.txt` (checksums) |
| **Convert Formats**   | `rslethz/action:convert-formats-latest`  | Converts MCAP files to CSV.                                | `.mcap`         | `.csv`             |
| **Extract Metadata**  | `rslethz/action:extract-metadata-latest` | Extracts metadata from bag files (topics, duration, etc.). | `.bag`, `.mcap` | Metadata tags      |
| **Python Script**     | `rslethz/action:python-template-latest`  | Run a custom Python script on your data.                   | Any             | Any                |
| **GPU Python Script** | `rslethz/action:gpu-example-latest`      | Run a custom Python script with GPU support.               | Any             | Any                |

::: tip Source Code for Example Actions
The source code of these example actions is available in the
[Kleinkram GitHub Repository](https://github.com/leggedrobotics/kleinkram/tree/main/examples/kleinkram-actions). You can
use these as a starting point for creating your own custom actions.
:::

## Using the Python SDK and CLI within Actions

The `kleinkram` CLI is the primary way to interact with the platform from within an action. It provides commands to
download data, upload artifacts, and more.

### Python Bindings

For Python actions, it is recommended to use the Python bindings instead of calling the CLI via `subprocess`. This
provides a more robust and pythonic way to interact with the API.

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

## Kleinkram CLI Example

This example uses a bash script to calculate SHA256 checksums of all files in a mission. It demonstrates how to use the
Kleinkram CLI directly.

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

## Python SDK Example

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
