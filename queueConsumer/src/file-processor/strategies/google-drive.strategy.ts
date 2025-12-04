import env from '@kleinkram/backend-common/environment';
import { FileLocation } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { drive_v3, google } from 'googleapis';
import { FileSourceResult, FileSourceStrategy } from './file-source.interface';
import Drive = drive_v3.Drive;

@Injectable()
export class GoogleDriveStrategy implements FileSourceStrategy {
    private drive: Drive;

    constructor() {
        const auth = new google.auth.GoogleAuth({
            keyFile: env.GOOGLE_KEY_FILE,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        this.drive = google.drive({ version: 'v3', auth });
    }

    supports(location: FileLocation): boolean {
        return location === FileLocation.DRIVE;
    }

    async fetch(fileId: string): Promise<FileSourceResult> {
        const meta = await this.drive.files.get({
            fileId,
            fields: 'name,mimeType,size',
            supportsAllDrives: true,
        });

        const streamRequest = await this.drive.files.get(
            { fileId, alt: 'media', supportsAllDrives: true },
            { responseType: 'stream' },
        );

        const mimeType: string | null | undefined = meta.data.mimeType;
        if (mimeType === null || mimeType === undefined) {
            throw new Error('unknown mimeType');
        }

        const size = Number(meta.data.size);

        return {
            stream: streamRequest.data,
            filename: meta.data.name ?? 'unknown',
            size,
            mimeType: mimeType,
        };
    }
}
