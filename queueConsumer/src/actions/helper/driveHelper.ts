import { google } from 'googleapis';
import env from '@common/env';

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const KEYFILEPATH = env.GOOGLE_ARTIFACT_UPLOADER_KEY_FILE;

const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
});
const drive = google.drive({ version: 'v3', auth });

export async function createDriveFolder(name: string) {
    const parent = env.GOOGLE_ARTIFACT_FOLDER_ID;
    const fileMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parent],
    };
    const res = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
        supportsAllDrives: true,
    });
    return res.data.id;
}
