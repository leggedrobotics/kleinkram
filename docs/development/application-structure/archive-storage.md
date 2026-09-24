# Archive Storage

Finished projects can be moved from the object storage (SeaweedFS) to a cheaper
**archive storage** and restored later. Archiving works per project; while a
project is archived its missions, metadata and topics stay browsable, but no
file can be downloaded, uploaded, moved or processed.

Kleinkram is not tied to one archive product. ETH LTS is the reference
deployment, the local stack ships a mock of it.

## What the storage has to provide

The archive storage is a **directory mounted into the queue consumer**
(NFS, SMB or a local disk) that behaves like cold, write-once storage:

| Property          | What Kleinkram relies on                                                                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Write once        | A written file can be renamed for a short while, then it is _sealed_: read-only for good (deletable, never changeable). Sealing is signalled by the file losing its write permission bits. Kleinkram keeps its own copy until all parts are sealed. |
| Few, large files  | Data arrives as tar files of `ARCHIVE_PART_SIZE_BYTES` (default 100 GB), never as many small files, and is never modified in place.                                                                                                                 |
| Slow reads are OK | Sealed files are only read sequentially, start to end, and copied to a local staging disk before they are unpacked. The first byte may take minutes to hours (tape recall).                                                                         |

A plain NFS share that never seals files on its own works too: with
`ARCHIVE_SEAL_MODE=self`, Kleinkram drops the write bits itself.

This is also why SeaweedFS cannot run on such storage: it rewrites its volume
files in place and reads them at random offsets.

## Layout

```
<ARCHIVE_ROOT>/kleinkram/<project uuid>/<archive uuid>/
├── manifest.yml        # index of all parts, missions and files
├── part-0001.tar
│   ├── <mission>/<filename>   # files byte for byte as uploaded
│   ├── ...
│   └── kleinkram.yml          # metadata of the files in this part
└── part-0002.tar
```

- Files are stored exactly as they were uploaded (ROS bags, MCAPs, ...), read
  through the S3 API, so no SeaweedFS chunks end up in the archive.
- Files are grouped into tar parts in order, so the files of a mission stay
  together. A part is closed once it reached `ARCHIVE_PART_SIZE_BYTES`; a
  remainder of less than half of that joins the previous part. A project
  smaller than the part size becomes a single tar, and no part is smaller
  than half the part size. A file never spans two tar files.
- Every tar ends with a `kleinkram.yml` listing the project, the missions of
  the part with their metadata, and every file with its size, MD5, SHA-256,
  recording times, categories and topics. A single tar can be extracted with
  `tar -xf` and verified without Kleinkram.

## Lifecycle

```
ACTIVE ─archive─▶ ARCHIVING: QUEUED → PACKING → VERIFYING → AWAITING_SEAL → PURGING ─▶ ARCHIVED
ARCHIVED ─restore─▶ RESTORING: RECALLING → UNPACKING ─▶ ACTIVE
```

The files are removed from S3 only after every part is sealed. The archived
copy is kept after a restore; archiving the unchanged project again reuses it
instead of writing a second copy.

## Enabling it

Archiving is **off by default**. Set `ARCHIVE_ENABLED=true` on the API server
and the queue consumer. While disabled, the archive endpoints answer 404, the
queue consumer does not process archive jobs and the frontend hides the
archive actions. Projects that are already archived stay read-only; enable
the feature again to restore them.

## Environment variables

These describe how to reach the storage.

| Variable                           | Service        | Description                                                                          | Default                |
| ---------------------------------- | -------------- | ------------------------------------------------------------------------------------ | ---------------------- |
| `ARCHIVE_ENABLED`                  | both           | Enables archiving and restoring.                                                     | `false`                |
| `ARCHIVE_CONFIG_PATH`              | both           | Config file described below.                                                         | unset                  |
| `ARCHIVE_ROOT`                     | queue consumer | Mount point of the archive storage.                                                  | `/mnt/archive`         |
| `ARCHIVE_STAGING_DIR`              | queue consumer | Local disk recalled parts are copied to; needs room for one part.                    | `/tmp/archive-staging` |
| `ARCHIVE_SEAL_MODE`                | queue consumer | `storage`: wait for the storage to seal files (ETH LTS: 1 h). `self`: seal on write. | `storage`              |
| `ARCHIVE_SIMULATED_RECALL_SECONDS` | queue consumer | Delay before reading a sealed part, only for mocks.                                  | `0`                    |
| `ARCHIVE_PART_SIZE_BYTES`          | both           | Target size of one tar part.                                                         | `107374182400`         |

## Config file

`ARCHIVE_CONFIG_PATH` points to a YAML file with what users (and anybody who
finds an archive years later) should know about the storage. Every field is
optional. It is deployment specific and, like the access config, not part of
the image.

```yaml
name: ETH Long Term Storage
description: >-
    Tape archive run by ETH IT Services, kept on two tapes at two sites.
costPerTbYear: 40 # shown as an estimate before archiving
currency: CHF
links:
    - label: LTS service description
      url: https://unlimited.ethz.ch/help/storage/lts-long-term-storage

# How to get the files back without Kleinkram. Shown on archived projects and
# written into manifest.yml and the kleinkram.yml of every tar.
# Placeholders: {projectName}, {projectUuid}, {archiveUuid}, {location}, {parts}
restoreInstructions: |-
    The files of "{projectName}" are on the LTS share of the lab, at {location}.
    1. Ask your ISG for read access to the share.
    2. Copy {parts} to a local disk; every read on the share is a tape recall.
    3. Unpack with `tar -xf <part>.tar` and check the files against the
       sha256 in the kleinkram.yml of each tar.
```

Without a config, Kleinkram calls it "archive storage", shows no cost and uses
generic restore instructions.

### ETH LTS

An NFSv3 export of an LTS share, requested through the department's ISG,
mounted at `ARCHIVE_ROOT` with `ARCHIVE_SEAL_MODE=storage`. LTS seals files
after its 1 h delay action timer and writes them to tape at two sites; it
wants objects of 10-200 GB (max. 2 TB) and charges CHF 40 per TB and year.

### Local mock

`docker compose up` enables archiving and starts `archive-mock`, which shares
the `archive_data` volume with the queue consumer and seals files 60 s after
they were written (`ARCHIVE_SEAL_DELAY_SECONDS`). The queue consumer waits 20 s
before reading a sealed part to stand in for a tape recall. The config used is
`docker/archive-mock/archive-config.yml`.
