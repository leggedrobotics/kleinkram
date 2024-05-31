# Getting Started (For Developers)

This guide will help you get started with the development of the project.

## Prerequisites for Development

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Setting Up the Development Environment

1. Clone the repository
2. Navigate to the project directory
3. Run the following command to start the development server

```bash
docker compose up --build --watch
```

::: tip
The `--watch` flag is optional and is used to watch for changes in the codebase.
:::

You can now open the projects frontend at [http://localhost:8003](http://localhost:8003).