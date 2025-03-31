# Kleinkram Actions

Actions are custom scripts executed within Docker containers on the Kleinkram platform. They enable data processing and
verification for uploaded content. Actions can be written in any programming language and may utilize a GPU for
acceleration.

[--> Writing Custom Actions](write-custom-actions.md)

## Storage, Disk Space, and Memory

By default, files within a Kleinkram action reside in the container's memory, contributing to its memory limit.

All data within the action's container is temporary and deleted upon completion. To persist data as
artifacts, store them in the `/out` directory. See [Artifacts and Output Files](#artifacts-and-output-files) for more
details.

::: tip Use `/tmp_disk` for Large Datasets
To manage larger datasets or avoid memory limitations, utilize the `/tmp_disk` directory. This directory is a mounted
volume from the host's disk, and files stored here do not impact the action's memory usage.
:::

### Artifacts and Output Files

Upon container termination (successful or failed), all files within the `/out` directory are uploaded to Google Drive. A
shareable link to the resulting folder is provided in the action's result. Output files are kept for three months before
being deleted.

::: tip Avoid Large Artifacts
Avoid placing excessively large files in `/out` to prevent upload timeouts.
:::

## Action Limitations

While actions provide powerful customization, they are subject to the following constraints:

- **Execution Time Limits:** Actions have a maximum runtime. Configurable via the web interface.
- **Memory Limits:** Actions are allocated a specific memory quota. Configurable via the web interface.
- **GPU Support:** GPU acceleration is available
  via [NVIDIA Docker Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/index.html),
  requested during action submission.
- **Access Scoping:** Actions are confined to the project they are executed within,
  see [Action Access Rights](#action-access-rights)
  for more details.

## Action Execution

Actions are launched through the Kleinkram web interface.

- **Templates:** Save frequently used actions as templates by clicking "Save New Template" for later reuse.
- **Submission:** Initiate action execution by clicking "Submit Action."

### Action Access Rights

Actions operate with project-level access controls:

- **`Read`:** Actions can only read data within the project and its missions.
- **`Create`:** Actions can read and create new data within the project and its missions (no modification).
- **`Write`:** Actions can read, create, and modify data within the project and its missions.
- **`Delete`:** Actions can read, create, modify, and delete data within the project and its missions.

**Project-Wide Access:** Actions have access to all missions within the project they are launched from.

::: tip Move Data Between Projects
Actions cannot directly access missions from other projects. To transfer data between
projects, create a new mission within the same project and then manually copy the data to another project by moving the
mission to the target project once the action is completed.
:::
