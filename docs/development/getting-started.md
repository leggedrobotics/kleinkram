# Getting Started (For Developers)

This guide will help you get started with the development of the project. It will start with some instructions on how to
run the project locally and how to set up the development environment.

## Prerequisites and Dependencies

In order to get started with the development of the project, you need to have the following tools installed on your
system:

- [Git](https://git-scm.com/downloads) (for cloning the repository)
- [Docker](https://docs.docker.com/get-docker/) (for running the project)
- [Docker Compose](https://docs.docker.com/compose/install/) (for running the project)
- Chrome or Firefox Browser (Safari might cause issues while developing locally)

::: info Additional Tools
To enable code completion and linting in your IDE, you may also need a NodeJS, yarn, and python installation.
:::

## Getting Started with Development

This section will guide you through setting up the development environment for the project.
In principle the setup works similar to running the project locally, however, there are some additional steps to take.

### Setting Up the Development Environment

1. Clone the repository
2. Run the following command to start the development server

    ```bash
    docker compose up --build --watch
    ```

::: tip

- the `--build` flag is used to build the project before starting the development server.
- the `--watch` flag is optional and is used to watch for changes in the codebase.
  :::

3. You can now open the projects:
    - frontend at `http://localhost:8003`.
    - minio console at `http://localhost:9001`.
    - documentation at `http://localhost:4000`.

    ::: warning
    There are some known issues with Safari while developing locally. Please use Chrome or Firefox instead.
    The production build does support Safari.
    :::

4. In order to enable code completion and linting in your IDE, you may need to install additional tools.
    - For JavaScript/TypeScript, you may need to install NodeJS and yarn.
    - For Python, you may need to install python and pip.

5. You can now install the dependencies for the frontend and the backend by running the following command in the
   top-level directory of the project:

    ```bash
    yarn install
    ```

::: info
The application continues to run in the Docker container, the above command installs the dependencies on your local
machine. This is necessary for code completion and linting in your IDE.
:::

6. For installing the cli, you can use the following command:

    ```bash
    cd kleinkram/cli

    virtualenv -ppython3.8 .venv
    source .venv/bin/activate
    pip install -e . -r requirements.txt
    ```

### Enable Database Seeding

In order to seed the database with mock data, you can run the following command:

````bash
# This will remove the existing database
docker compose down --volumes

# enable seeding by changing SEED in the .env file to true
sed -i 's/SEED=false/SEED=true/' .env

```bash
# This will seed the database with mock data
docker compose up --build --watch
````

### Configuration

The application can be configured using environment variables.

- `VITE_DOCKER_HUB_NAMESPACE`: This variable restricts which Docker Hub namespaces can be used for actions. If set, only images starting with this namespace (e.g., `my-org/`) will be allowed. If left empty, any image can be used. This is important for security in production environments.

### Fake OAuth Provider

For development purposes, Kleinkram includes a `fake-oauth` provider. This allows you to log in without setting up a real OAuth application with Google or GitHub.

To use it with the CLI:

```bash
klein login --oauth-provider fake-oauth
```

This provider is only available when the application is running in development mode (i.e., when the API endpoint is set to a local instance).

#### Auto-Select User for Automated Testing

The fake OAuth provider supports automatic user selection, which is useful for automated testing and CI/CD pipelines. You can specify a user ID to automatically log in without any browser interaction:

```bash
# Login as admin user (user 1)
klein login --oauth-provider fake-oauth --user 1

# Login as internal user (user 2)
klein login --oauth-provider fake-oauth --user 2

# Login as external user (user 3)
klein login --oauth-provider fake-oauth --user 3
```

**Available fake users:**

| User ID | Email                         | Role          | Description                                                             |
| ------- | ----------------------------- | ------------- | ----------------------------------------------------------------------- |
| 1       | `admin@kleinkram.dev`         | Admin         | Has admin access, sees all seeded projects                              |
| 2       | `internal-user@kleinkram.dev` | Internal User | Part of affiliation group, can create projects, sees no seeded projects |
| 3       | `external-user@example.com`   | External User | Cannot create projects, sees no projects by default                     |

::: tip
The `--user` parameter only works with the `fake-oauth` provider. Using it with other providers (Google, GitHub) will result in an error.
:::

::: info
When using `--user`, the authentication happens entirely programmatically without opening a browser, making it perfect for automated scripts and testing.
:::
