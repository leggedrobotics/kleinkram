# Frequently Asked Questions

::: details How do I process my data?
You can use Actions to validate, convert, and process your data. See the [Actions guide](actions/use-actions.md).
:::

::: details What file formats are supported?
Kleinkram supports the most common robotics data formats. See the [Files documentation](files/files.md) for the full list.
:::

::: details How can I automate my workflow?
You can use our Python SDK to script and automate your interactions. See the [Python SDK guide](python/sdk.md).
:::

::: details How to write a custom action?
See [Write Custom Actions](actions/write-actions.md) for instructions on creating custom actions.
:::

::: details How do I download only part of a recording?
For `.mcap` files, `klein download` can fetch only some topics or a time window. See [Partial Download](files/partial-download.md).
:::

::: details Should I compress my MCAP files?
Compress the chunks inside the file, never the whole file: `.mcap.zst` or `.mcap.gz` files cannot be uploaded. Compressed chunks make partial downloads by topic expensive. See [MCAP Chunking and Compression](files/compression.md).
:::

::: details Why is my file marked as Corrupted?
Its content does not match its file type, or it cannot be read, e.g. an `.mcap` from a recording that was cut off. Hover over the state icon for the reason. See [File States](files/files.md#file-states).
:::

::: details How do I log in on a machine without a browser?
`klein login` switches to a headless login when it finds no browser. See [Headless Login](python/setup.md#headless-login).
:::

::: details How does the access control work?
See the [Access Control documentation](/usage/access-control/base-concepts) for more information.
:::

::: details I found a bug, what should I do?
Please report any issues on our [GitHub repository](https://github.com/leggedrobotics/kleinkram/issues).
:::
