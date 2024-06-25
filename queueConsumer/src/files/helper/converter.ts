import { loadDecompressHandlers } from '@mcap/support';
import { McapIndexedReader } from '@mcap/core';

import { promisify } from 'util';
import { exec } from 'child_process';
import { traceWrapper } from '../../tracing';
import logger from '../../logger';
import { open } from 'fs/promises';
import { FileHandleReadable } from '@mcap/nodejs';
import {uploadFile} from "./minioHelper";
import env from "@common/env";

const execPromisify = promisify(exec);

export async function convertToMcapAndSave(tmp_file_name: string, full_pathname: string): Promise<boolean> {
    return await traceWrapper(async () => {
        const tmp_file_name_mcap = tmp_file_name.replace('.bag', '.mcap');
        const full_pathname_mcap = full_pathname.replace('.bag', '.mcap');

        logger.debug(`Converting file ${tmp_file_name} from bag to mcap ${tmp_file_name_mcap}`);
        await convert(tmp_file_name, tmp_file_name_mcap);
        logger.debug('File converted successfully');

        return await uploadFile(
            env.MINIO_MCAP_BUCKET_NAME,
            full_pathname_mcap,
            tmp_file_name_mcap,
        );

    }, 'processFile')();
}

export async function convert(
    infile: string,
    outfile: string,
): Promise<boolean> {

    // Convert file
    return await traceWrapper(async (): Promise<boolean> => {
        await execPromisify(`mcap convert ${infile} ${outfile}`);
        return true;
    }, 'MCAP Conversion')()
        .catch((error) => {
            logger.error(error);
            throw new Error(
                error.message.startsWith('Command failed: mcap convert ')
                    ? 'Corrupted' : error.message);
        });

}

export async function mcapMetaInfo(mcap_tmp_file_name: string):
    Promise<{ topics: Record<string, unknown>[], date: Date, size: number }> {
    const decompressHandlers = await loadDecompressHandlers();
    const fileHandle = await open(mcap_tmp_file_name, 'r');

    const file_size = (await fileHandle.stat()).size;
    const reader = await McapIndexedReader.Initialize({
        readable: new FileHandleReadable(fileHandle),
        decompressHandlers,
    });

    await fileHandle.close();

    const topics: Record<string, unknown>[] = [];
    const stats = reader.statistics;
    const duration = stats.messageEndTime - stats.messageStartTime;
    reader.channelsById.forEach((channel) => {
        const schema = reader.schemasById.get(channel.schemaId);
        const nr_messages = stats.channelMessageCounts.get(channel.id);
        const topic = {
            name: channel.topic,
            type: schema.name,
            nrMessages: nr_messages,
            frequency:
                Number(nr_messages) / (Number(duration / 1000n) / 1000000),
        };
        topics.push(topic);
    });

    return {
        topics: topics,
        date: new Date(Number(stats.messageStartTime / 1000000n)),
        size: file_size,
    };
}