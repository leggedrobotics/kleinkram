# Kleinkram CLI Usage

Make sure to first read the [getting started](./getting-started.md) guide to install the CLI and authenticate yourself.

## General Concepts (Mission Spec)

Most commands are based on you specifying a `mission` which you want to interact with. There are multiple ways to specify a mission.

- Specify the mission by ID.
- Specify a project (either by ID or name) and specify as mission name.

This is achieved by specifying the options `-m` / `--mission` and `-p` / `--project` respectively. As an example consider the following:

```bash
klein mycommand -p myproject -m mymission
```

Is telling `mycommand` to do something to the mission `mymission` inside the project `myproject`.

## Uploading Files

You can use the command `upload` to upload files to a specified mission as follows:

```bash
klein upload -p myproject -m mymission a.bag b.bag c.bag
```

You can also use unix wild cards to specify file patters. Be aware that any file you specify has to have the file suffix `.bag` or `.mcap`.

::: details Creating Mission on Upload
If you wish to create a mission on upload you can use the flag `--create`. Importantly this will only create the mission if the specified project already exists. Furthermore, in this case you need to specify the mission by name.

```bash
klein upload --create -p myproject -m mymission a.bag b.bag c.bag
```

:::

## Downloading Files

If you wish to download the files of a specific mission you can use the following command:

```bash
klein download -p myproject -m mymission --dest dest
```

where `dest` is the destination folder for the downloaded files. In case `dest` does not exist it is created and if it already contains files we will skip files that already exist.

## Verifying Files

If you wish to verify if you correctly uploaded files to a mission you can use the command

```bash
klein verify -p myproject -m mymission a.bag b.bag c.bag
```

It accepts similar commands to the `upload` command and check if all specified files were uploaded correctly. If you wish to skip file hash verification you can use the `--skip-hash` flag.
