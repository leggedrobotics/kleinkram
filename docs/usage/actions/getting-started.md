# Kleinkram Actions

Actions are custom scripts that can be run on the Kleinkram platform. They are used to process and verify data uploaded
to Kleinkram. Actions are run in a docker container and can be written in any language.

[--> How to write custom actions](write-custom-actions.md)

## Artifacts / Output Files

When the docker container terminates, successfully or not, all files within the `/out` directory are uploaded to google
drive. A link, granting access to the respective folder is provided in the action's result. Don't put excessively large
files in the /out directory or the upload will time out.

## Storage, Disk Space and Memory

By default, all files stored inside a Kleinkram action live in the host's memory and count towards the memory limit of
the action. We provide the `/tmp_disk` directory which is a mounted volume from the host's disk. Files stored
inside `/tmp_disk` do not count towards the memory limit of the action.

All data stored inside a Kleinkram action is deleted after the action finishes. If you want to keep data as an artifact,
you need to store it in the `/out` directory. See the [Artifacts](#artifacts) section for more information.

## Limitations of Actions

Actions provide great flexibility but are subject to the following limitations:

- Actions can only run for a limited time
- Actions can only use a limited amount of memory
- Actions can request GPU support via Nvidia docker (requested on submission)
- The access rights of actions are limited to the project they are run in

## How to Launch an Action

Action can be launched via the Webinterface of Kleinkram. If you want to save an action as a template for later use,
you can do so by clicking the "Save New Template" button. To launch an action, click on "Submit Action".
