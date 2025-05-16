---
title: 'Kleinkram: Open Robotic Data Management'
tags:
  - Python
  - robotics
  - data management
  - multi-modal
authors:
  - name: Cyrill Püntener
    orcid: 0009-0000-5231-9310
    corresponding: true
    equal-contrib: true
    affiliation: "1"
  - name: Johann Schwabe
    corresponding: true
    equal-contrib: true
    affiliation: "1"
  - name: Dominique Garmier
    corresponding: true
    equal-contrib: false
    affiliation: "1"
  - name: Marvin Lichtsteiner
    affiliation: "1"
  - name: Lars Leuthold
    affiliation: "1"
  - name: Jonas Frey
    orcid: 0000-0002-7401-2173
    corresponding: true
    equal-contrib: false
    affiliation: "1, 2"
  - name: Marco Hutter
    orcid: 0000-0002-4285-4990
    equal-contrib: false
    affiliation: 1
affiliations:
  - name: Robotic Systems Lab, ETH Zurich, Switzerland
    index: 1
  - name: Max Planck Institute for Intelligent Systems, Tübingen, Germany
    index: 2
date: 14 May 2025
bibliography: paper.bib
---

# Summary

Data is key to advancing robotic perception, navigation, locomotion, and reasoning. However, managing diverse robotic
datasets presents unique challenges, including scalability, quality assurance, and seamless integration into diverse
workflows. To address this gap, we introduce Kleinkram, a free and open-source data management system tailored for
robotics research. Kleinkram enables efficient storage, indexing, and sharing of datasets, from small experiments to
large-scale collections. It supports essential workflows like validation, curation, and benchmarking via customizable
compute actions. Designed with a user-friendly web interface, CLI integration, and scalable deployment options,
Kleinkram empowers researchers to streamline data management and accelerate robotics innovation.

# Statement of need

To render robotic data usfeull for research, it is essential to store, organize, and index the data in a way that makes
it easily searchable and shareable.
While large corporations have developed internal tools or rely on closed-source third-party providers, no openly
available, ready-to-use, and easy-to-deploy solution exists for the robotics research community. Additionally, features
such as data verification and the ability to perform tailored compute jobs on newly generated datasets are highly
desirable, as they facilitate benchmarking, reproducibility and algorithmic development.

To address these challenges, we introduce **Kleinkram**, an on-premise cloud solution designed for scalable and
efficient data management. Unlike traditional cloud storage, Kleinkram natively integrates compute capabilities,
automates data transfer, and eliminates the tedious manual effort typically associated with data management workflows.
By categorizing and structuring data around common robotics use cases, Kleinkram facilitates the creation of large,
diverse datasets that can be easily shared and reused across multiple projects. Its intuitive web interface ensures
accessibility, while a command-line interface (CLI) enables seamless integration into automated pipelines and headless
systems. Kleinkram supports widely adopted standards, building on ROS1 and ROS2 message definitions, and offers native
compatibility with ROSbag and MCAP data formats.

# Data Structure and Usage

Kleinkram is designed around the typical data generation process in mobile robotics, assuming data is collected and
stored primarily in ROS1/ROS2-compatible rosbag or MCAP file formats.

Once data recording for an experiment is complete, these files can be efficiently uploaded and ingested into the
Kleinkram system for centralised storage, indexing, and subsequent post-processing. It is important to note that the
current version of Kleinkram focuses on post-recording and data management. It does not support real-time data streaming
or processing on the fly.

To provide structure and facilitate organisation and retrieval, Kleinkram requires data to be organised according to a
strict three-layer hierarchy: Projects, Missions, and Files. Each layer maintains a one-to-many relationship with the
layer below it. While users have flexibility in how they map their specific activities to this structure, the intended
model is that a Project represents a distinct research project, which requires data storage. A Mission corresponds to a
single, self-contained experiment or data collection run conducted within that project, and it contains all the
individual data Files (like rosbag or MCAP files) recorded during that specific deployment. This structured approach
aids in navigating, managing, and understanding large volumes of experimental data.

# System Architecture

Kleinkram's system architecture is modular and comprises several interacting microservices.

- **Python Client Library and CLI**
  Provides programmatic access to Kleinkram's functionalities, enabling efficient data transfer operations (upload,
  download) directly from Python scripts or the command line. This allows seamless integration into robotic workflows
  and automated data pipelines running on robots or workstations, removing the need for manual browser interaction or
  network file system mounts for data transfer.

  The CLI is built using the typer library, sharing a core Python codebase with the client library.


- **Web interface**
  Serves as the primary graphical user interface for users to interact with Kleinkram. It allows for the browsing,
  managing, and structuring of files and their metadata.

  It is implemented as a single-page application using the Vue3 framework and the Quasar component library.


- **Backend API**
  Acts as the central communication layer between the client applications (web UI and Python client/CLI) and the data
  storage and processing components. It handles authentication, data indexing, metadata management, and schedules
  background tasks.

  The backend is implemented using the NestJS framework and utilises a PostgreSQL database for storing all metadata
  related to projects, missions, files, users, and actions.


- **Data Store**
  The raw robotic data files (rosbags, MCAPs) are stored on an S3-compatible object storage backend. This provides
  scalability and flexibility. Users can easily deploy and manage their own storage using self-hosted solutions like
  MinIO, or utilise public cloud S3 services. Kleinkram interacts with the data store via the S3 API.


- **Action Runner**
  This component enables the execution of customisable data processing and analysis tasks directly on the data stored
  within Kleinkram. Users can define "Actions" (e.g., validate data integrity, extract sensor metadata, generate preview
  visualisations, convert formats, run benchmarking scripts).

  These actions are packaged as Docker containers. The action runner orchestrates the execution of these containers,
  providing them access to the necessary data from the data store using the client library or CLI.


- **Observability**
  (Optional) Monitoring and logging system performance, resource usage, and task execution status are crucial for
  managing a scalable data system. Integration with observability tools, such as the Grafana Stack (Loki for logs,
  Prometheus for metrics, Tempo for traces, Grafana for dashboards), can provide insights into the system's health and
  the progress of the data processing task.

# Usecase

Kleinkram has been used internally at the Robotic Systems Lab at ETH Zurich over the past year. During this time, it has
stored over 20 TB of data collected from a variety of robotic systems, effectively replacing the lab’s previous reliance
on Google Drive for data storage. The largest project supported by Kleinkram was the **GrandTour dataset** [ref], in
which our legged robot **ANYmal** [ref], equipped with **Boxi** [ref], a multi-sensor payload, was deployed across
various locations in Switzerland.

Following each data collection mission, raw data — recorded in the form of ROSbags and MCAP files — was uploaded
directly to Kleinkram via its command-line interface (CLI). The intuitive Docker-based integration allowed us to easily
define and execute data verification tests. These included, for example, checks to ensure that all sensor streams were
recorded at the expected frequencies and correct timesynchronization was established during the distributed recordings,
as well as common sense checking for validity of data (e.g. images are not black or the IMUs measure the gravity
vector).

Beyond data verification, Kleinkram enabled us to run full SLAM pipelines retrospectively, automatically producing
standard Absolute and Relative Trajectory Error (ATE/RTE) metrics. This compute integration was critical for
development, benchmarking, and evaluation.

Equally important was Kleinkram’s user-friendly CLI, which provided quick access to summary statistics such as dataset
counts, durations, and other key metrics — many of which were directly used in associated publications. Thanks to fast
networking within the ETH infrastructure, users could pull datasets on demand to their local machines and delete them
afterward, enabling an efficient and lightweight workflow.

Throughout the project, Kleinkram also enforced metadata submission during upload. Users were required to include a YAML
file describing the mission, which captured essential information such as the robot operator, specific hardware
configuration, location, and links to related resources (e.g., associated Google Drive folders for images). This
structured metadata was essential for organizing and retrieving data at scale.

# Acknowledgements

[To be completed - Acknowledge funding sources, collaborators, etc.]

# References

[To be completed - List cited literature here]
