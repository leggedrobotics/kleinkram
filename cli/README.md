# Kleinkram: CLI

Install the package

```bash
pip install kleinkram
```

Run the CLI

```bash
klein
```

## Usage

Here are some basic examples of how to use the CLI.

### Listing Files

To list all files in a mission:

```bash
klein list -p project-name -m mission-name
```

### Uploading Files

To upload all `*.bag` files in the current directory to a mission:

```bash
klein upload -p project-name -m mission-name *.bag
```

If you would like to create a new mission on upload use the `--create` flag.

### Downloading Files

To download all files from a mission and save them `out`:

```bash
klein download -p project-name -m mission-name --dest out
```

You can additionally specify filenames or ids if you only want to download specific files.

Instead of downloading files from a specified mission you can download arbitrary files by specifying their ids:

```bash
klein download --dest out *id1* *id2* *id3*
```

For more information consult the [documentation](https://docs.datasets.leggedrobotics.com/usage/cli/cli-getting-started.html).

## Development

Clone the repo

```bash
git clone git@github.com:leggedrobotics/kleinkram.git
cd kleinkram/cli
```

Setup the environment

```bash
virtualenv -ppython3.8 .venv
source .venv/bin/activate
pip install -e . -r requirements.txt
```

Install `pre-commit` hooks

```bash
pre-commit install
```

Run the CLI

```bash
klein --help
```

### Run Tests
```bash
pytest .
```

You can also look in `scripts` for some scripts that might be useful for testing.
