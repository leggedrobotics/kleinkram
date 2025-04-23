import env from '@common/environment';
import { google } from 'googleapis';

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
    const result = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
        supportsAllDrives: true,
    });
    return result.data.id;
}
