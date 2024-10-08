# Files

Kleinkram only supports .bag & .mcap files. All other files should be stored in a different Cloud Storage Solution like Google drive.

As .bag files are deprecated, Kleinkram encourages the transition to MCAP by automatically converting all bag files to mcap on upload. The .bag files are also saved.
Features like topic extraction is only supported on MCAPs and thus filtering by topics also.

## File States
In the Kleinkram UI the filestates are displayed as Icons with a short explanation on hover. Here a more indepth explanation.

| Icon                                                                                           | Name             | Description                                                                                                                                    |
|------------------------------------------------------------------------------------------------|------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| <span class="material-symbols-outlined" style="color: green">check_circle</span>               | OK               | Everything is OK                                                                                                                               |
| <span class="material-symbols-outlined" style="color: green">helicopter</span>                 | Found            | The File was found in the File storage but not in the database. It was then restored. This should not happen! Contact an Admin.                |
| <span class="material-symbols-outlined" style="color: orange">arrow_upload_progress</span>     | Uploading        | The File is being uploaded to the File Storage. Should switch to OK when completed. Will switch to ERROR after 12h in UPLOADING.               |
| <span class="material-symbols-outlined" style="color: orange">move_up</span>                   | Moving           | The File is being moved within the File Storage. This can happen when a Mission is moved to another project or a project / mission is renamed. |
| <span class="material-symbols-outlined" style="color: red">pulse_alert</span>                  | Lost             | The File is registered within the database but cannot be found in the File Storage. This is bad. Contact an Admin!                             |
| <span class="material-symbols-outlined" style="color: red">conversion_path_off</span>          | Conversion Error | The File was uploaded, the MD5 was correct but it is not a valid bag / mcap. Check locally if it is valid. If it is, contact an Admin!         |
| <span class="material-symbols-outlined" style="color: red">error</span>                        | Error            | Something went wrong. Contact an Admin to find out more.                                                                                       |
| <span class="material-symbols-outlined" style="color: red">sentiment_very_dissatisfied</span>  | Corrupted        | The File was uploaded but its MD5 hash doesn't match. Contact an Admin.                                                                        |
