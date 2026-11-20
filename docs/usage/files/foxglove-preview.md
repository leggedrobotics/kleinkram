# Preview in Foxglove

The **Preview** tab of a mission opens its `.mcap` and `.bag` files in an embedded
[Foxglove](https://foxglove.dev) viewer. You need a Foxglove account; the viewer asks you to sign in the first time.

## Open the preview

- Open a mission and select the **Preview** tab. All files of the most common format are selected and loaded.
- Or select files on the **Files** tab and click **Preview** in the selection bar. Only those files are loaded. If they
  mix formats, only the files of the first format are loaded, and a message says how many were skipped.

Foxglove merges files of one format only. If a mission has both `.mcap` and `.bag` files, switch between them with the
format toggle above the file list. Only files in state `OK` or `FOUND` are listed.

## Settings

| Setting                  | What it does                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foxglove organization    | Slug of the Foxglove organization you sign in to inside the viewer. Remembered in this browser.                                                                                     |
| Stream                   | Foxglove fetches signed download links and reads only the parts of each file it needs. Best for large files.                                                                        |
| Download first           | Kleinkram downloads the selected files completely in the browser and hands them to Foxglove. Foxglove needs no access to the storage. Used by default on a local `localhost` setup. |
| Compare instead of merge | Only with _Download first_: shows the files side by side instead of as one merged timeline.                                                                                         |
| Project / Mission layout | Foxglove keeps the panel layout in this browser, either one per project or one per mission.                                                                                         |

The toolbar also exports the current layout as JSON and switches the preview to fullscreen.

## Turn the preview off

The Preview tab is on by default. Two switches hide it, and the tab is shown only when both are on:

- **Per project:** a user with `Write` rights on the project turns off **Foxglove preview** in the project's edit dialog.
- **For the whole instance:** an admin turns off **Foxglove preview** under **Settings** on the System page. The API
  equivalent is `PUT /system/settings` with `{ "foxglovePreviewEnabled": false }`; only admins may call it.

Turning the preview off hides the Preview tab and the **Preview** button on the Files tab. A link to a mission's preview
then opens its file list. The signed Foxglove links of single files keep working.

## Notes for operators

The signed Foxglove links under `/integrations/foxglove/` answer CORS requests from `https://app.foxglove.dev` and
`https://embed.foxglove.dev` (`GET` and `HEAD`, without credentials). All other API routes still accept only
`FRONTEND_URL` and `DOCS_URL`.
