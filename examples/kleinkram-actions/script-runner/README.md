# Script Runner Action

The image behind `klein action run-script`. It is not a template you copy: there is one shared `script-runner` template
per Kleinkram deployment, and every single-file Python action runs on it.

## How it works

Unlike the other example actions, this image contains no analysis code. On startup, `run_script.py`:

1. reads the presigned URL Kleinkram put in `KLEINKRAM_SCRIPT_URL`,
2. downloads the submitted script to a temporary file, and
3. `exec`s `python3` on it, so the script's exit code becomes the action's exit code.

Everything else behaves like any other action: `/out` is collected as an artifact, `/tmp_disk` is host-backed scratch
space, and the usual `KLEINKRAM_*` variables (API key, project, mission and action UUIDs, endpoints) are set.

## The dependency set is fixed

A single-file action cannot bring a `requirements.txt`, so the image ships one fixed set of libraries. If your script
imports anything outside this list, it will fail at import time and you need a
[real Docker action](../python-template) instead.

| Package             | For                                                |
| :------------------ | :------------------------------------------------- |
| `kleinkram`         | The Kleinkram Python SDK and CLI                   |
| `mcap`              | Reading MCAP files                                 |
| `mcap-ros2-support` | Decoding ROS 2 messages inside MCAP files          |
| `rosbags`           | Reading ROS 1 and ROS 2 bags without a ROS install |
| `numpy`             | Arrays and numerics                                |
| `scipy`             | Signal processing, interpolation, optimisation     |
| `pandas`            | Dataframes and time series                         |
| `matplotlib`        | Plots written to `/out`                            |
| `pyyaml`            | Reading and writing YAML                           |
| `pyarrow`           | Parquet and Arrow output                           |
| `transforms3d`      | Rotations, quaternions and homogeneous transforms  |
| `pyproj`            | Geodetic and map projections                       |

`klein action deps` prints the same list from the CLI. The authoritative source is `requirements.txt` next to this
README; versions are whatever the image tag was built with, so pin the image tag if you need reproducibility.

## Limits

- Scripts are capped at 1 MiB.
- Resources (CPU, memory, GPU) and the maximum runtime come from the `script-runner` template, which Kleinkram
  seeds by migration and does not let anyone edit. `--timeout` can lower the runtime budget for a single run, never raise it.
- There is no GPU variant: `script-runner` is a CPU image.
