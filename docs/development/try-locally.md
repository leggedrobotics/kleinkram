# Try Kleinkram Locally

You can easily run a local instance of Kleinkram to try it out.
This has been tested on Ubuntu 24.04 and macOS.

1. **Clone the repository**

```bash
git clone git@github.com:leggedrobotics/kleinkram.git
cd kleinkram
```

2. **Clear Previous Data (Optional)**

::: warning Clear Local Data if you have used Kleinkram before
If you have used Kleinkram before, you should consider deleting all corresponding data including `~/.kleinkram.json` and running `docker compose down --volumes` inside the cloned repo directory to clear all docker related data.

This ensures you start with a clean database and avoids the need to run migrations.
:::

3. **Start the application**

```bash
docker compose up --build
```

::: details Why `--build`?
The `--build` flag ensures that the Docker images are built before starting. For more details on Docker Compose, see the [official docs](https://docs.docker.com/compose/).
:::

4. **Open the application**

You can now access the frontend at `http://localhost:8003`.

::: tip Browser Compatibility
Make sure to use Chrome or Firefox for the best experience with
the local development server. There are some known iessues related to Safari when running Kleinkram locally.
:::

5. **Configure CLI (Optional)**

If you want to use the CLI with your local instance, you need to set the endpoint to local:

```bash
klein endpoint local
```

::: details Start Developing
For a deeper dive into the project structure and development workflow, see the [Application Structure](./application-structure.md) documentation.

Your development environment is designed for Ubuntu 24.04.
:::

## Next Steps

Now that you have Kleinkram running, check out the [User Documentation](../usage/getting-started.md) to learn how to use it!
