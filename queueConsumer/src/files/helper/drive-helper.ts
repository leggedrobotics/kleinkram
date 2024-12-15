import { google } from 'googleapis';
import env from '@common/environment';
import logger from '../../logger';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const KEYFILEPATH = env.GOOGLE_KEY_FILE;

const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
});
const drive = google.drive({ version: 'v3', auth });

export async function downloadDriveFile(
    fileId: string,
    destination: string,
): Promise<string> {
    const results = await drive.files.get(
        {
            fileId,
            alt: 'media',
            supportsAllDrives: true,
        },
        { responseType: 'stream' },
    );
    const destinationStream = fs.createWriteStream(destination);
    const hash = crypto.createHash('md5');

    logger.debug(`Downloading file to ${destination}`);
    return await new Promise((resolve, reject) => {
        results.data
            .on('end', () => {
                const fileHash = hash.digest('base64');
                logger.debug('File downloaded successfully.');
                resolve(fileHash);
            })
            .on('data', (chunk) => {
                hash.update(chunk);
            })
            .on('error', (error) => {
                logger.debug(`Error downloading file: ${error}`);
                reject(error);
            })
            .pipe(destinationStream);
    });
}

export async function getMetadata(fileId: string) {
    const metadataResults = await drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType',
        supportsAllDrives: true,
    });
    return metadataResults.data;
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
