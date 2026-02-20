import env from '@kleinkram/backend-common/environment';
import { StorageService } from '@kleinkram/backend-common/modules/storage/storage.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import { promisify } from 'node:util';
import logger from '../logger';

const execAsync = promisify(exec);
const unlinkAsync = promisify(fs.unlink);

@Injectable()
export class DBDumper {
    constructor(
        private readonly configService: ConfigService,
        private readonly storageService: StorageService,
    ) {
        logger.debug('DBDumper service created');
    }

    @Cron(CronExpression.EVERY_2ND_HOUR)
    async handleCron(): Promise<string> {
        logger.debug('Dumping database...');

        const DB_HOST = this.configService.getOrThrow<string>('database.host');
        const DB_PORT = this.configService.getOrThrow<number>('database.port');
        const DB_USERNAME =
            this.configService.getOrThrow<string>('database.username');
        const DB_PASSWORD =
            this.configService.getOrThrow<string>('database.password');
        const DB_NAME =
            this.configService.getOrThrow<string>('database.database');

        const dumpFile = `backup-${Date.now().toString()}.sql`;

        // The pg_dump command
        const command = `PGPASSWORD=${DB_PASSWORD} pg_dump -h ${DB_HOST} -p ${DB_PORT.toString()} -U ${DB_USERNAME} -F c -b -v -f ${dumpFile} ${DB_NAME}`;

        try {
            // Execute the command
            await execAsync(command);

            await this.storageService.uploadFile(
                env.S3_DB_BUCKET_NAME,
                dumpFile, // object name (in bucket)
                dumpFile, // file path (local system)
            );

            await unlinkAsync(dumpFile);
            return dumpFile;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            // Attempt to clean up if the file was created but upload failed
            if (fs.existsSync(dumpFile)) {
                await unlinkAsync(dumpFile).catch(() => ({}));
            }

            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access
            throw new Error(`Failed to create database dump: ${error.message}`);
        }
    }
}
