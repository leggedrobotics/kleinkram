# How to Write Custom Actions

Custom Kleinkram actions are implemented as Docker containers. Inside the container, you interact with the Kleinkram
platform using the Kleinkram CLI. The [Kleinkram CLI](/usage/python/getting-started) is a Python package installable via
`pip`.

::: tip Download and List Files inside a Kleinkram Action

The following example shows how to create a simple action that downloads data from a mission and lists the files.

```Dockerfile
FROM python:latest

# Install Kleinkram CLI
RUN pip install kleinkram --force-reinstall

# Copy entrypoint script and make it executable
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

With the following entrypoint script:

```bash
#!/bin/bash

# Exit on error (non-zero exit codes mark action as failed)
set -e

echo "Get Started with Kleinkram Actions 🚀"

# Authenticate with the API key from environment variables
klein login --key "$KLEINKRAM_API_KEY"

echo "Download data from mission with UUID $KLEINKRAM_MISSION_UUID"
mkdir data
klein download -m "$KLEINKRAM_MISSION_UUID" --dest ./data

echo "List files of mission with UUID $KLEINKRAM_MISSION_UUID"
cd ./data || exit 1
ls -la
```

:::

## Environment Variables

The following environment variables are available within the Docker container during action execution:

- `KLEINKRAM_API_KEY`: API key for Kleinkram API authentication.
- `KLEINKRAM_PROJECT_UUID`: UUID of the project the action is running within.
- `KLEINKRAM_MISSION_UUID`: UUID of the mission the action is operating on.
- `KLEINKRAM_ACTION_UUID`: UUID of the currently running action.
- `KLEINKRAM_API_ENDPOINT`: Endpoint of the Kleinkram API.
- `KLEINKRAM_S3_ENDPOINT`: Endpoint of the Kleinkram S3 storage.

::: warning Deprecated Environment Variables
The following environment variables are deprecated and will be removed in the future:

- `APIKEY` (Use `KLEINKRAM_API_KEY` instead)
- `PROJECT_UUID` (Use `KLEINKRAM_PROJECT_UUID` instead)
- `MISSION_UUID` (Use `KLEINKRAM_MISSION_UUID` instead)
- `ACTION_UUID` (Use `KLEINKRAM_ACTION_UUID` instead)
- `ENDPOINT` (Use `KLEINKRAM_API_ENDPOINT` instead)

:::

## Push Actions to Docker Hub

Kleinkram actions must be pushed to Docker Hub under the rslethz/*** namespace. To publish your action:

```bash
# login to docker hub
docker login

# build the image
docker build -t rslethz/my-action .

# push the image
docker push rslethz/my-action
```
