# Kleinkram - A structured bag and mcap storage solution

Kleinkram is a structured bag and mcap file storage solution for ROS1 and ROS2.
It is designed to be a simple and efficient way to store and retrieve bag and mcap files.
Kleinkram is being developed by the [Robotic Systems Lab (RSL) at ETH Zurich](https://rsl.ethz.ch/).

## Features

- **Simple**: Kleinkram is designed to be simple to use and easy to understand.
- **Efficient**: Kleinkram is designed to be efficient in terms of storage and retrieval.
- **Structured**: Kleinkram is designed to be structured in terms of storage and retrieval.
- **ROS1 and ROS2**: Kleinkram is designed to work with both ROS1 and ROS2.

## Getting Started

Consult the [Getting Started](https://docs.datasets.leggedrobotics.com/usage/getting-started.html) guide for users or
the [Getting Started](https://docs.datasets.leggedrobotics.com/development/getting-started.html) guide for developers.

## Installation

Clone the repository:

```bash
git clone git@github.com:leggedrobotics/kleinkram.git
cd kleinkram
```

Install `yarn` dependencies:

```bash
yarn
```

Now you can run Kleinkram using `docker compose`

```bash
docker compose up
```

This will launch the frontend under `http://localhost:8003`,
the minio console at `http://localhost:9001`, the documentation
at `http://localhost:4000` and the api at `http://localhost:3000`.

## Documentation

You can read the documentation deployed by RSL at [docs.datasets.leggedrobotics.com](https://docs.datasets.leggedrobotics.com/).
