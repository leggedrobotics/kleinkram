import { Injectable } from '@nestjs/common';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import env from '@common/environment';
import { internalMinio } from '@common/minio-helper';
import logger from '../logger';

const execAsync = promisify(exec);
const unlinkAsync = promisify(fs.unlink);

@Injectable()
export class DBDumper {
    constructor(private readonly configService: ConfigService) {
        logger.debug('DBDumper service created');
    }

    @Cron(CronExpression.EVERY_2ND_HOUR)
    async handleCron(): Promise<string> {
        logger.debug('Dumping database...');
        // const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME } =
        //     process.env;
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
            await internalMinio.fPutObject(
                env.MINIO_DB_BUCKET_NAME,
                dumpFile,
                dumpFile,
            );
            await unlinkAsync(dumpFile);
            return dumpFile;
        } catch (error: any) {
            await unlinkAsync(dumpFile);

             
            throw new Error(`Failed to create database dump: ${error.message}`);
        }
    }
}
