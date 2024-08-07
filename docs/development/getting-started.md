# Getting Started (For Developers)

This guide will help you get started with the development of the project. It will start with some instructions on how to
run the project locally and how to set up the development environment.

## Running the Project Locally

The following steps will help you run the project locally on your machine.

### Prerequisites to Run the Project

In order to get started with the development of the project, you need to have the following tools installed on your
system:

-   [Git](https://git-scm.com/downloads) (for cloning the repository)
-   [Docker](https://docs.docker.com/get-docker/) (for running the project)
-   [Docker Compose](https://docs.docker.com/compose/install/) (for running the project)

::: info Additional Tools
To enable code completion and linting in your IDE, you may also need a NodeJS, yarn, and python installation.
:::

### Steps to Run the Project

1. Clone the repository

```bash
git clone <repository-url>
```

2. Navigate to the project directory

```bash
cd <project-directory>
```

3. Run the following command to start the development server

```bash
docker compose up --build
```

4. You can now open the projects frontend at [http://localhost:8003](http://localhost:8003).

::: info
The `--build` flag is used to build the project before starting the development server.
:::

::: tip
A full overview of the project structure can be found in the [Application Structure](./application-structure.md)
documentation.
:::

## Getting Started with Development

This section will guide you through setting up the development environment for the project.
In principle the setup works similar to running the project locally, however, there are some additional steps to take.

### Setting Up the Development Environment

1. Clone the repository
2. Navigate to the project directory
3. Run the following command to start the development server

```bash
docker compose up --build --watch
```

::: tip

-   the `--build` flag is used to build the project before starting the development server.
-   the `--watch` flag is optional and is used to watch for changes in the codebase.
    :::

4. You can now open the projects frontend at [http://localhost:8003](http://localhost:8003).

5. In order to enable code completion and linting in your IDE, you may need to install additional tools.

    - For JavaScript/TypeScript, you may need to install NodeJS and yarn.
    - For Python, you may need to install python and pip.

6. You can now install the dependencies for the frontend and the backend by running the following command in the
   top-level directory of the project:

    ```bash
    yarn install
    ```

    ::: info
    The application continues to run in the Docker container, the above command installs the dependencies on your local
    machine. This is necessary for code completion and linting in your IDE.
    :::
