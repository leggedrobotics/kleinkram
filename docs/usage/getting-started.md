# Welcome to Kleinkram

Kleinkram is an open-source, self-hosted platform for managing and processing robotics data. It provides a structured way to store, organize, and act on your data, ensuring that your valuable field logs and datasets are never lost and always accessible.

## What can I use Kleinkram for?

- **Organize**: Keep your data structured in a strict hierarchy of Projects and Missions.
- **Store**: Securely store large robotics files like `.bag`, `.mcap`, and `.svo2`.
- **Process**: Run automated actions to validate, convert, and analyze your data using Docker.
- **Collaborate**: Share data easily with your team through a centralized web interface.

![Landing Page](/assets/landingpage.png)

## Core Concepts

Kleinkram organizes data in a three-level hierarchy: **Project**, **Mission**, and **File**.

### Data Hierarchy

- **Project**: The top-level container. Projects are used to group related missions together. For example, a project could be "Field Testing 2024" or "Warehouse Logistics". Access control is typically managed at the project level.
- **Mission**: A specific data collection event or experiment. A mission belongs to exactly one project. For example, "Mission 1: Calibration Run" or "Mission 2: Obstacle Avoidance".
- **File**: The actual data files (e.g., `.bag`, `.mcap`, `.db3`, `.yaml`) collected during a mission. Files belong to exactly one mission.

### Metadata and Tags

Kleinkram allows you to organize and search your data using metadata and tags at different levels.

#### Mission Level: Metadata Tags

You can add key-value pairs as metadata to missions. This allows for powerful filtering and organization.

- **Enforcement**: You can enforce specific metadata keys at the **Project** level. This ensures that all missions within a project have consistent metadata (e.g., requiring a "Robot ID" or "Location" tag for every mission).
- **Usage**: Use these tags to quickly find all missions performed by a specific robot or in a specific location.

::: tip Example: GrandTourDataset
The GrandTourDataset uses a Metadata Tag `Short Name` to identify the mission in addition to the mission name `release_2024-11-04-10-57-34`. This is useful for quickly identifying the mission in the Kleinkram UI.

![Metadata and Tags UI](/assets/metadata.png)
:::

#### File Level: Category Tags

At the file level, you can use **Category Tags** to label specific files.

- **Usage**: Tag files as `Raw Data`, `Processed`, `Calibration`, or `Validated`. This helps in distinguishing between different types of data within the same mission.

## Next Steps: Uploading Data

The primary way to upload data to Kleinkram is using the **Kleinkram CLI**.

1.  **Install the CLI**:

    ```bash
    pip install kleinkram
    ```

2.  **Authenticate**:

    ```bash
    klein login
    ```

3.  **Upload Data**:
    ```bash
    klein project create "My Project"
    klein upload -p "My Project" -m "Mission 1" --create ./data/*.bag
    ```

For more details on installation and usage, see the [CLI Documentation](python/cli.md).
