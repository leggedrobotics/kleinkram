# Kleinkram CLI

The CLI is a command-line interface that allows you to interact with the kleinkram platform. It is a powerful tool that
can be used to manage your projects, up- and download files, and much more.

## Getting Started

Normally you install the CLI globally using the following command:

```bash
pip install kleinkram
```

However, if you want to develop the CLI locally, you can do so by following these steps:

### Step-By-Step Guide for Local Development

1. Start the application using the following command:

    ```bash
    docker compose up --build --watch -d
    ```

2. Navigate to the `/CLI` directory and install the dependencies:

    ```bash
    pip install -r requirements.txt
    ```

3. Run the CLI using the following command inside the `/CLI/src` directory:

    ```bash
    python3 klein.py [[command]] [[options]]
    ```

    ::: details Use `klein ...` instead of `python3 klein.py ...`
    If you define the following alias in your `.bashrc` or `.zshrc` file, you can run the local code of the CLI from
    anywhere in your terminal, similar to the global installation of the kleinkram CLI:

    ```bash
    alias klein="python3 /path/to/kleinkram/CLU/src/klein.py"
    ```

    :::
