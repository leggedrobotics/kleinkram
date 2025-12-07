import env from '@kleinkram/backend-common/environment';
import { FileLocation } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { drive_v3, google } from 'googleapis';
import * as fs from 'node:fs';
import { Readable } from 'node:stream';
import logger from '../../logger';
import { FileSourceResult, FileSourceStrategy } from './file-source.interface';
import Drive = drive_v3.Drive;

@Injectable()
export class GoogleDriveStrategy implements FileSourceStrategy {
    private drive: Drive | undefined;

    constructor() {
        let auth;
        try {
            if (env.GOOGLE_KEY_FILE && fs.existsSync(env.GOOGLE_KEY_FILE)) {
                if (fs.statSync(env.GOOGLE_KEY_FILE).isFile()) {
                    auth = new google.auth.GoogleAuth({
                        keyFile: env.GOOGLE_KEY_FILE,
                        scopes: [
                            'https://www.googleapis.com/auth/drive.readonly',
                        ],
                    });
                } else {
                    logger.warn(
                        `Google Cloud Service Account Key File at ${env.GOOGLE_KEY_FILE} is not a file. ` +
                            'Google Drive integration will only work for public links.',
                    );
                }
            } else {
                logger.warn(
                    `Google Cloud Service Account Key File not found at ${env.GOOGLE_KEY_FILE}. ` +
                        'Google Drive integration will only work for public links.',
                );
            }
        } catch (error: unknown) {
            logger.warn(
                `Failed to initialize Google Auth: ${String(error)}. ` +
                    'Google Drive integration will only work for public links.',
            );
        }

        if (auth) {
            this.drive = google.drive({ version: 'v3', auth });
        }
    }

    supports(location: FileLocation): boolean {
        return location === FileLocation.DRIVE;
    }

    async fetch(fileId: string): Promise<FileSourceResult> {
        try {
            if (this.drive) {
                try {
                    const meta = await this.drive.files.get({
                        fileId,
                        fields: 'name,mimeType,size',
                        supportsAllDrives: true,
                    });

                    const streamRequest = await this.drive.files.get(
                        { fileId, alt: 'media', supportsAllDrives: true },
                        { responseType: 'stream' },
                    );

                    const mimeType: string | null | undefined =
                        meta.data.mimeType;
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
                } catch (apiError: unknown) {
                    logger.warn(
                        `Google API fetch failed, falling back to public download: ${String(apiError)}`,
                    );
                    // Fallback to public download if API fails
                    return await this.fetchPublicFile(fileId);
                }
            } else {
                return await this.fetchPublicFile(fileId);
            }
        } catch (error: unknown) {
            const driveError = error as { code?: number; message?: string };
            if (driveError.code === 403 || driveError.code === 404) {
                throw new Error(
                    `File not found or access denied (ID: ${fileId}). ` +
                        'If the file is private, please ensure the Google Service Account has access.',
                );
            }
            throw error;
        }
    }

    private async fetchPublicFile(fileId: string): Promise<FileSourceResult> {
        const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
        const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream',
            validateStatus: (status) => status < 400,
        });

        const headers = response.headers as Record<string, string | undefined>;
        const contentDisposition = headers['content-disposition'];

        let filename = 'unknown_google_drive_file';
        if (contentDisposition) {
            const match = /filename="?([^"]+)"?/.exec(contentDisposition);
            if (match?.[1]) {
                filename = match[1];
            }
        }

        const contentLength = headers['content-length'];
        const size = contentLength ? Number(contentLength) : 0;
        const mimeType = headers['content-type'] ?? 'application/octet-stream';

        return {
            stream: response.data as Readable,
            filename,
            size,
            mimeType,
        };
    }
}
