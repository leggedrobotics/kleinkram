import { google } from 'googleapis';
import env from '@common/env';
import logger from '../../logger';
import * as fs from 'node:fs';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const KEYFILEPATH = env.GOOGLE_KEY_FILE;

const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
});
const drive = google.drive({ version: 'v3', auth });

export async function downloadDriveFile(fileId: string, dest: string): Promise<boolean> {
    const res = await drive.files.get(
        {
            fileId,
            alt: 'media',
            supportsAllDrives: true,
        },
        { responseType: 'stream' },
    );
    const destStream = fs.createWriteStream(dest);

    logger.debug(`Downloading file to ${dest}`);
    return await new Promise((resolve, reject) => {
        res.data
            .on('end', () => {
                logger.debug('File downloaded successfully.');
                resolve(true);
            })
            .on('error', (err) => {
                logger.debug(`Error downloading file: ${err}`);
                reject(err);
            })
            .pipe(destStream);

    });
}

export async function getMetadata(fileId: string) {
    const metadataRes = await drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType',
        supportsAllDrives: true,
    });
    return metadataRes.data;
}

export async function listFiles(folderId: string) {
    const response = await drive.files.list({
        q: `'${folderId}' in parents`,
        fields: 'nextPageToken, files(id,name,mimeType)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });
    return response.data.files;
}
