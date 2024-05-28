import { google } from 'googleapis';
import env from '../env';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const KEYFILEPATH = env.GOOGLE_KEY_FILE;

const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
});
const drive = google.drive({ version: 'v3', auth });

export async function downloadDriveFile(fileId: string): Promise<Buffer> {
    const res = await drive.files.get(
        {
            fileId,
            alt: 'media',
            supportsAllDrives: true,
        },
        { responseType: 'stream' },
    );
    const chunks = [];
    return await new Promise((resolve, reject) => {
        res.data
            .on('data', (chunk) => chunks.push(chunk))
            .on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve(buffer);
            })
            .on('error', (err) => {
                console.error('Error downloading file.');
                reject(err);
            });
    });
}

export async function getMetadata(fileId: string) {
    const metadataRes = await drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType',
    });
    return metadataRes.data;
}

export async function listFiles(folderId: string) {
    const response = await drive.files.list({
        q: `'${folderId}' in parents`,
        fields: 'nextPageToken, files(id,name,mimeType)',
    });
    return response.data.files;
}
