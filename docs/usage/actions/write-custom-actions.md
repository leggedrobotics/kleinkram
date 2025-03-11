# How to Write Custom Actions

To write a custom action, you need to create a docker container. Inside the container you can use the Kleinkram CLI
to interact with the platform. The [Kleinkram CLI](/usage/python/getting-started) is a Python package that can be
installed via pip.

::: tip Download and List Files inside a Kleinkram Action

The following example shows how to create a simple action that downloads data from a mission and lists the files.

```Dockerfile
FROM python:latest

# install kleinkram as CLI
RUN pip install kleinkram --force-reinstall

# copy entrypoint and make it executable
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

With the following entrypoint script:

```bash
#!/bin/bash

# exit on error
# (all non-zero exit codes mark the action as failed)
set -e

echo "Get Started with Kleinkram Actions 🚀"

# Authenticate with the API_KEY from the environment variables
klein login --key $APIKEY

echo "Download data from mission with UUID $MISSION_UUID"
mkdir data
klein download -m $MISSION_UUID --dest ./data # download the files of the mission

echo "List files of mission with UUID $MISSION_UUID"
cd ./data || exit 1
ls -la
```

:::

## Environment Variables

When running an action the following environment variables are available inside the docker container:

- `KLEINKRAM_API_KEY`: The API_KEY authenticates the action with the Kleinkram API
- `KLEINKRAM_PROJECT_UUID`: The UUID of the project the action is run on
- `KLEINKRAM_MISSION_UUID`: The UUID of the mission the action is run on
- `KLEINKRAM_ACTION_UUID`: The UUID of the action that is running
- `KLEINKRAM_API_ENDPOINT`: The endpoint of the Kleinkram API
- `KLEINKRAM_S3_ENDPOINT`: The endpoint of the Kleinkram S3 storage

::: warning Deprecated Environment Variables
The following environment variables are deprecated and will be removed in the future:

- `APIKEY`: The API key used to authenticate with the Kleinkram API using `klein login --key $APIKEY`
- `PROJECT_UUID`: The UUID of the project the action is run on
- `MISSION_UUID`: The UUID of the mission the action is run on
- `ACTION_UUID`: The UUID of the action that is running
- `ENDPOINT`: The endpoint of the Kleinkram API

:::

## Push Actions to Docker Hub

Actions must be pushed to Docker Hub at `rslethz/***`. For that you need to authenticate with Docker Hub and push the
image.

```bash
# login to docker hub
docker login

# build the image
docker build -t rslethz/my-action .

# push the image
docker push rslethz/my-action
```
