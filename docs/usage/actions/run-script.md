# Run a Single Python File

Most of the time you do not want to build an action, you want to answer a question about a mission: is this bag's TF
tree complete, how far did the robot drive, what do the IMU rates look like. Writing a Dockerfile, pushing an image and
registering a template for that is a lot of ceremony for twenty lines of Python.

`klein action run-script` skips all of it. You hand Kleinkram a `.py` file; it stores the file, runs it on a shared
runner image, streams the logs back, and exits non-zero if the run did not finish cleanly.

```bash
klein action run-script ./analyse.py -p my-project -m my-mission
```

Nothing is built, and nothing is pushed. The script is not baked into an image: it is stored by Kleinkram and fetched
by the runner when the container starts.

## What your script gets

A script runs in exactly the same environment as any other Kleinkram action, so everything in
[Write Custom Actions](write-actions.md) still applies:

- The usual environment variables are set: `KLEINKRAM_API_KEY`, `KLEINKRAM_API_ENDPOINT`, `KLEINKRAM_PROJECT_UUID`,
  `KLEINKRAM_MISSION_UUID` and `KLEINKRAM_ACTION_UUID`. The `kleinkram` SDK picks these up on its own.
- Anything written to `/out` is collected as an artifact when the run finishes.
- `/tmp_disk` is host-backed scratch space for data too big to keep in the container layer.
- `klein action warn` / `fail` / `info` report findings without encoding them in the exit code.

```python
import os

import kleinkram

mission = os.environ["KLEINKRAM_MISSION_UUID"]
kleinkram.download(mission_ids=[mission], dest="/data")

# ... analyse /data ...

with open("/out/report.txt", "w") as report:
    report.write("all good\n")
```

## The dependency set is fixed

A single file cannot bring a `requirements.txt` with it, so the runner image ships one fixed set of libraries:

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

Plus the Python 3.11 standard library. `klein action deps` prints the same list, so you can check before you submit:

```bash
klein action deps
```

If your script imports anything else, it fails at import time. That is the signal to
[write a real action](write-actions.md) instead.

## Limits

| Limit            | Value                                                                               |
| :--------------- | :---------------------------------------------------------------------------------- |
| Script size      | 1 MiB                                                                               |
| Language         | Python 3.11, one file, no local imports                                             |
| CPU, memory, GPU | 2 cores and 4 GB by default, set by the `script-runner` template; no GPU            |
| Runtime          | 15 minutes by default; `--timeout <minutes>` can only lower it                      |
| Permissions      | The same rights on the project that launching the `script-runner` template requires |

```bash
# fail fast instead of burning the full runtime budget on a hung script
klein action run-script ./analyse.py -p my-project -m my-mission --timeout 10

# submit and walk away; check back with `klein executions logs <id>`
klein action run-script ./analyse.py -p my-project -m my-mission --no-follow
```

## When to write a real action instead

Reach for a [custom Docker action](write-actions.md) when:

- you need a dependency that is not in the fixed set, or a specific version of one;
- your code no longer fits in one file, or you want to test it as a package;
- you need a GPU;
- you want the same analysis to run automatically on new data, via an [Action Trigger](triggers.md);
- you want the run to be reproducible against a pinned image you control.

`run-script` is for the exploratory pass. Once the script is something you rely on, it deserves an image and a template.

::: tip The Runner Image
The runner is an ordinary Kleinkram action image, built from
[`examples/kleinkram-actions/script-runner`](https://github.com/leggedrobotics/kleinkram/tree/main/examples/kleinkram-actions/script-runner).
Every instance gets the `script-runner` template from a database migration. It is managed by Kleinkram: it shows up in
the template list, but it cannot be edited or deleted, because every `run-script` execution on the instance depends on
it. By default it grants 2 CPU cores, 4 GB of memory and 15 minutes of runtime, and requires write access to the
project.
:::
