import { loadDecompressHandlers } from '@mcap/support';
import { McapIndexedReader } from '@mcap/core';

import { promisify } from 'util';
import { exec } from 'child_process';
import { traceWrapper } from '../../tracing';
import logger from '../../logger';
import { open } from 'fs/promises';
import { FileHandleReadable } from '@mcap/nodejs';

const execPromisify = promisify(exec);

export async function convertToMcap(tmp_file_name: string): Promise<string> {
    return await traceWrapper(async () => {
        const tmp_file_name_mcap = tmp_file_name.replace('.bag', '.mcap');

        logger.debug(
            `Converting file ${tmp_file_name} from bag to mcap ${tmp_file_name_mcap}`,
        );
        await convert(tmp_file_name, tmp_file_name_mcap);
        logger.debug('File converted successfully');
        return tmp_file_name_mcap;
    }, 'convertToMcap')();
}

export const convert = (infile: string, outfile: string): Promise<boolean> =>
    traceWrapper(async (): Promise<boolean> => {
        await execPromisify(`mcap convert ${infile} ${outfile}`);
        return true;
    }, 'MCAP Conversion')();

export async function mcapMetaInfo(
    mcap_tmp_file_name: string,
): Promise<{ topics: Record<string, unknown>[]; date: Date; size: number }> {
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
