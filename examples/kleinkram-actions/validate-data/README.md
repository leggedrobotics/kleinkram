# Validate Data Action

An action to validate the integrity and quality of robotics data.

## Description

This action performs various checks on the mission data:

- Verifies file checksums (MD5).
- Checks for corrupt bags or MCAP files.
- Validates that required topics are present (if configured).

## Findings

The checks above do not fail the run. A mission with a duplicated recording is still
checksummed successfully, so the action exits `0` and stays `DONE` — it reports what it
found instead, and Kleinkram shows the run in amber as done with warnings.

| Code                | Severity  | Raised when                                                            |
| ------------------- | --------- | ---------------------------------------------------------------------- |
| `FILES_CHECKED`     | `INFO`    | Always, recording how many files were checksummed.                     |
| `EMPTY_MISSION`     | `WARNING` | The mission contains no files at all.                                  |
| `EMPTY_FILE`        | `WARNING` | A file is zero bytes, which usually means an interrupted upload.       |
| `DUPLICATE_CONTENT` | `WARNING` | Two files have the same checksum, so the same data was uploaded twice. |

See [Write Custom Action Templates](../../../docs/usage/actions/write-actions.md) for how
`klein action warn` works and how the findings are shown.

## Usage

Run this action to ensure that your uploaded data is valid and ready for processing.
