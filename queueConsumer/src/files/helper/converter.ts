import { loadDecompressHandlers } from '@mcap/support';
import { McapIndexedReader } from '@mcap/core';

import { promisify } from 'util';
import { exec } from 'child_process';
import { traceWrapper } from '../../tracing';
import logger from '../../logger';
import { open } from 'fs/promises';
import { FileHandleReadable } from '@mcap/nodejs';

const execPromisify = promisify(exec);

export async function convertToMcap(tmpFileName: string): Promise<string> {
    return await traceWrapper(async () => {
        const tmpFileNameMcap = tmpFileName.replace('.bag', '.mcap');

        logger.debug(
            `Converting file ${tmpFileName} from bag to mcap ${tmpFileNameMcap}`,
        );
        await convert(tmpFileName, tmpFileNameMcap);
        logger.debug('File converted successfully');
        return tmpFileNameMcap;
    }, 'convertToMcap')();
}

export const convert = (infile: string, outfile: string): Promise<boolean> =>
    traceWrapper(async (): Promise<boolean> => {
        await execPromisify(`mcap convert ${infile} ${outfile}`);
        return true;
    }, 'MCAP Conversion')();

export async function mcapMetaInfo(
    mcapTmpFileName: string,
): Promise<{ topics: Record<string, unknown>[]; date: Date; size: number }> {
    const decompressHandlers = await loadDecompressHandlers();
    const fileHandle = await open(mcapTmpFileName, 'r');

    const fileSize = (await fileHandle.stat()).size;
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
        const nrMessages = stats.channelMessageCounts.get(channel.id);
        const topic = {
            name: channel.topic,
            type: schema.name,
            nrMessages: nrMessages,
            frequency:
                Number(nrMessages) / (Number(duration / 1000n) / 1000000),
        };
        topics.push(topic);
    });

    return {
        topics: topics,
        date: new Date(Number(stats.messageStartTime / 1000000n)),
        size: fileSize,
    };
}
