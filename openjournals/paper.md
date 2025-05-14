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
    orcid: 0000-0000-0000-0000
    corresponding: true
    equal-contrib: true
    affiliation: "1"
  - name: Dominique Garmier
    orcid: 0000-0000-0000-0000
    corresponding: true
    equal-contrib: false
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
Data is key to advancing robotic perception, navigation, locomotion, and reasoning. However, managing diverse robotic datasets presents unique challenges, including scalability, quality assurance, and seamless integration into diverse workflows. To address this gap, we introduce Kleinkram, a free and open-source data management system tailored for robotics research. Kleinkram enables efficient storage, indexing, and sharing of datasets, from small experiments to large-scale collections. It supports essential workflows like validation, curation, and benchmarking via customizable compute actions. Designed with a user-friendly web interface, CLI integration, and scalable deployment options, Kleinkram empowers researchers to streamline data management and accelerate robotics innovation.

# Statement of need

In many research projects, datasets are recorded for specific purposes but often become difficult to retrieve or utilise after the project concludes. While some datasets are published, they are typically not categorised in a way that facilitates reuse by other researchers. However, efficient data exchange and documentation are essential for collaborative research.

Simple cloud storage solutions address only the issue of data exchange and are often too slow and impractical for large-scale research applications, as they lack proper indexing.

To address these challenges, we introduce Kleinkram, an on-premise cloud solution designed for scalable and efficient data management. Unlike conventional cloud storage, Kleinkram integrates cloud computing directly, automating data transfer and leveraging fast inter-server interconnects to remove tedious manual work. By categorising and structuring data, Kleinkram enables the composition of large, diverse datasets that can be shared and reused across multiple projects. Its web interface ensures accessibility and ease of use, while a command-line interface (CLI) allows for seamless integration into automated workflows and headless systems.

# Data Structure / Use Cases
Kleinkram is designed around the typical data generation process in mobile robotics, assuming data is collected and stored primarily in ROS1/ROS2-compatible rosbag or MCAP file formats.

Once data recording for an experiment is complete, these files can be efficiently uploaded and ingested into the Kleinkram system for centralised storage, indexing, and subsequent post-processing and archiving. It is important to note that the current version of Kleinkram focuses on post-recording and data management. It does not yet support real-time data streaming or processing on the fly.


To provide structure and facilitate organisation and retrieval, Kleinkram requires data to be organised according to a strict three-layer hierarchy: Projects, Missions, and Files. Each layer maintains a one-to-many relationship with the layer below it. While users have flexibility in how they map their specific activities to this structure, the intended model is that a `Project` represents a distinct research challenge. A `Mission` corresponds to a single, self-contained experiment or data collection run conducted within that project, and it contains all the individual data `Files` (like rosbag or MCAP files) recorded during that specific deployment. This structured approach aids in navigating, managing, and understanding large volumes of experimental data.

# System Architecture
Kleinkram's system architecture is modular, comprising several interacting building blocks. These blocks are conceptually grouped into a client-side library and container-based services running on a server infrastructure.


*Python Client Library and CLI*
Provides programmatic access to Kleinkram's functionalities, enabling efficient data transfer operations (upload, download) directly from Python scripts or the command line. This allows seamless integration into robotic workflows and automated data pipelines running on robots or workstations, removing the need for manual browser interaction or network file system mounts for data transfer.

The CLI is built using the `typer` library, sharing a core Python codebase with the client library.
*Web interface*
Serves as the primary graphical user interface for users to interact with Kleinkram. It allows for the browsing, managing, and structuring of files and their metadata.

It is implemented as a single-page application using the Vue3 framework and the Quasar component library.


*Backend API*
Acts as the central communication layer between the client applications (web UI and Python client/CLI) and the data storage and processing components. It handles authentication, data indexing, metadata management, and schedules background tasks.

The backend is implemented using the NestJS framework and utilises a PostgreSQL database for storing all metadata related to projects, missions, files, users, and actions.


Data Store
The raw robotic data files (rosbags, MCAPs) are stored on an S3-compatible object storage backend. This provides scalability and flexibility. Users can easily deploy and manage their own storage using self-hosted solutions like MinIO, or utilise public cloud S3 services. Kleinkram interacts with the data store via the S3 API.


Action Runner
This component enables the execution of customisable data processing and analysis tasks directly on the data stored within Kleinkram. Users can define "Actions" (e.g., validate data integrity, extract sensor metadata, generate preview visualisations, convert formats, run benchmarking scripts).

These actions are packaged as Docker containers. The action runner orchestrates the execution of these containers, providing them access to the necessary data from the data store using the client library or CLI.


Observability
(Optional) Monitoring and logging system performance, resource usage, and task execution status are crucial for managing a scalable data system. Integration with observability tools, such as the Grafana Stack (Loki for logs, Prometheus for metrics, Tempo for traces, Grafana for dashboards), can provide insights into the system's health and the progress of the data processing task.

# Acknowledgements
