# Archive Projects

Finished projects whose data has to be kept, but is rarely needed, can be
moved to cold **archive storage** (at ETH: the ETH Long Term Storage, a tape
archive). Archiving frees the Kleinkram storage; the project and its metadata
stay in Kleinkram.

::: info
Archiving is optional and has to be enabled by the operators of your
Kleinkram instance. If you do not see _Archive Project_ in the project menu,
it is not available.
:::

## What changes when a project is archived

| Still possible                                       | Not possible until restored               |
| ---------------------------------------------------- | ----------------------------------------- |
| Browse and search missions, files and topics         | Download files or copy download links     |
| Read and edit metadata, categories and access rights | Preview messages, open files in Foxglove  |
| Rename missions and files                            | Upload, move or delete files and missions |
|                                                      | Run actions, delete the project           |

## Archive a project

You need the _Delete_ right on the project.

1. Open the project and choose **⋮ → Archive Project**.
2. Check the summary: number of files, size, number of tar parts and,
   if your instance configured a price, the yearly cost of the storage.
   Uploads or actions that are still running block the archive.
3. Optionally give a reason, e.g. _Paper published, keep raw data for 10
   years_, and confirm with the project name.

The project becomes read-only immediately. The banner on the project page
shows the progress:

1. **Packing** – the files are copied into large tar files on the archive
   storage.
2. **Verifying** – every tar file is read back and its checksum compared.
3. **Sealing** – the archive storage makes the tar files read-only for good
   (at ETH LTS after one hour, before they are written to tape).
4. **Freeing storage** – only now are the files removed from Kleinkram.

## Restore a project

Choose **Restore** in the banner of an archived project and say why you need
the data. Reading from cold storage is slow: large projects take hours to
restore and progress is shown on the project page. Once all files are back
the project works as before.

The archived copy is kept. If you archive the project again without changing
its files, nothing is written again; Kleinkram only frees its storage.

## Get the files without Kleinkram

The archive does not depend on Kleinkram. Every archive is a directory of tar
files on the archive storage:

- The files are stored exactly as they were uploaded (ROS bags, MCAPs, ...),
  at `<mission>/<filename>` inside the tar files. A file is never split
  across two tar files.
- Every tar file ends with a `kleinkram.yml` listing the project, the missions
  with their metadata and every file with its size, MD5 and SHA-256, recording
  times, categories and topics.
- A `manifest.yml` next to the tar files indexes the whole archive.

The instructions of your instance (where the files are and whom to ask for
access) are shown under _Access the files without Kleinkram_ in the banner of
an archived project, and are also written into every `kleinkram.yml`.
