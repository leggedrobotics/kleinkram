# Kleinkram Actions

Actions are custom scripts that can be run on the Kleinkram platform. They are used to process and verify data uploaded
to Kleinkram. Actions are run in a docker container and can be written in any language.

## How to Write Custom Actions

To write a custom action, you need to create a docker container. Inside the container you can use the Kleinkram CLI
to interact with the platform. The [Kleinkram CLI](/usage/cli-api/cli-getting-started) is a Python package that can be
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
klein mission byUUID $MISSION_UUID          # get the mission details
klein mission download $MISSION_UUID /out # download the files of the mission

echo "List files of mission with UUID $MISSION_UUID"
cd ./data || exit 1
ls -la

```

:::

## Artifacts

When the docker container terminates, successfully or not, all files within the `/out` directory are uploaded to google drive.
A link, granting access to the respective folder is provided in the action's result. Don't put excessively large files in the /out directory or the upload will time out.

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

## Submit and Run a Kleinkram Action

You can now submit the action to Kleinkram. You can do this via the web interface.

## Limitations

-   Actions can only run for a limited time
-   Actions can only use a limited amount of memory
-   Actions can request GPU support via Nvidia docker (requested on submission)
