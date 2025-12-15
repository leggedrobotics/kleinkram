# Convert Formats Action

An action to convert robotics data files between different formats.

## Description

This action automatically converts MCAP files found in the mission data to CSV format for easier analysis.

- **Input**: `.mcap`
- **Output**: `.csv` (one per topic)

It uses the `kleinkram` SDK to download data and standard tools for conversion.

## Usage

Run this action on a mission to ensure all data is available in the desired format (e.g., MCAP).
