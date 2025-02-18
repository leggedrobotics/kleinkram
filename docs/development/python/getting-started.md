# Kleinkram CLI / Python Package

Kleinkram can also be used via a command line interface (CLI) or a python package.
This offers an easy way to interact with the platform in a programmatic way.
In particular this can be used to upload and download files, create and update projects aswell as missions.

## Usage

If you wish to use the CLI follow the [Getting Started](../../usage/python/getting-started.md) guide.

## Development Setup

First you need to follow the steps described in the [Getting Started (For Developers)](../getting-started.md) guide.

Next make sure to navigate to the `/cli` directory of repository.
Now setup a `python3.8` virtual enviroment and install the dependencies:

```bash
virtualenv -p python3.8 .venv
source .venv/bin/activate
pip install -e . -r requirements-dev.txt
```

At this point you can already run the CLI locally:

```bash
klein --help
```

Furthermore if you run:

```
klein endpoint
```

the CLI should automatically detect that you are running the CLI locally as highlighted in the output of the above command.
Otherwise you should now set the CLI to use the `local` endpoint by running:

```bash
klein endpoint local
```

In case you wish to test the local version of the CLI against the `dev` or even `prod` backend you can do so by running:

```bash
klein endpoint dev
klein endpoint prod
```

If you want you can also run the CLI as a module which should be functionally equivalent to the above command:

```
python -m kleinkram
klein # same as above
```

## Project Structure

The `/cli` folder is structured as a python package using the [flat layout](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/).
Which means the layout looks something like this:

```
cli/
├── README.md
├── pyproject.toml
├── setup.py
├── setup.cfg
├── ...
├── kleinkram/
│   ├── __init__.py
│   ├── __main__.py
│   ├── main.py
│   └── ...
├── tests/
│   ├── __init__.py
│   └── ...
└── testing/
    ├── __init__.py
    └── ...
```

- The `kleinkram` module contains the actual implementation of the CLI.
- The `tests` module contains the tests for the CLI, we use the `pytest` framework for this.
- The `testing` module contains utilities used in tests such as fixtures (but no tests themselves).

### Packaging

For packaging we use [declarative metadata](https://www.youtube.com/watch?v=GaWs-LenLYE) inside the `setup.cfg`.
Depending on the python distrubution you are using you might need to install `setuptools` seperately ([read more here](https://packaging.python.org/en/latest/guides/distributing-packages-using-setuptools/)).

### Source Code

Let's take a closer look at the `kleinkram` module. A non-exhaustive list of the most important files and folders is given below:

#### `__init__.py`

Here we expose all the public functions that can be used if the cli is used as a python package.

#### `__main__.py`

This is the main entry point of the CLI.

#### `main.py`

This contains the `main` function that is called by `__main__.py`. If you wish to embed the CLI into another application you should import this `main` function.

#### `core.py`

Contains all the highlevel functions that interact with the backend.

#### `models.py`

Contains python representations for objects that also exist on the backend.

#### `errors.py`

Contains custom exceptions that are raised by the `kleinkram` package.

#### `api/`

In this folder we have all the bindings for the kleinkram API. This includes:

- `client.py` implementation of an authenticated HTTP client (we use [`httpx`](https://www.python-httpx.org/) as a HTTP framework).
- `pagination.py` wrapper around the HTTP client that supports paginated requests via generators.
- `deser.py` deserialization of the API responses (serialization should also go here).
- `routes.py` all the api routes and low level functions that interact with those endpoints
- `query.py` abstractions for specificying resources on the backend (e.g. querying projects, missions and files)
- `file_transfer.py` implementation of the uploading and downloading. For the uploads we use [`boto3`](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html) to interact with the S3 compatible storage.

#### `cli/`

Here we have all the code related to the different cli commands.
Each command is mostly a wrapper around the `kleinkram` package with some addition argument parsing and input validation.

- `app.py` contains the [`typer`](https://typer.tiangolo.com/) application that is used to define the CLI. We also implement the simpler cli commands directly in this file
- `error_handling` contains a wrapper of the default `typer.Typer` class that adds error handling to the CLI.
- `_*.py` are the different sub commands that are too complex to keep in a single file.
