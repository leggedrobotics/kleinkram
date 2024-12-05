import { loadDecompressHandlers } from '@mcap/support';
import { McapIndexedReader } from '@mcap/core';

import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { traceWrapper } from '../../tracing';
import logger from '../../logger';
import { open } from 'node:fs/promises';
import { FileHandleReadable } from '@mcap/nodejs';

const execPromisify = promisify(exec);

export async function convertToMcap(
    temporaryFileName: string,
): Promise<string> {
    return await traceWrapper(async () => {
        const temporaryFileNameMcap = temporaryFileName.replace(
            '.bag',
            '.mcap',
        );

        logger.debug(
            `Converting file ${temporaryFileName} from bag to mcap ${temporaryFileNameMcap}`,
        );
        await convert(temporaryFileName, temporaryFileNameMcap);
        logger.debug('File converted successfully');
        return temporaryFileNameMcap;
    }, 'convertToMcap')();
}

export const convert = (infile: string, outfile: string): Promise<boolean> =>
    traceWrapper(async (): Promise<boolean> => {
        await execPromisify(`mcap convert ${infile} ${outfile}`);
        return true;
    }, 'MCAP Conversion')();

export async function mcapMetaInfo(
    mcapTemporaryFileName: string,
): Promise<{ topics: Record<string, unknown>[]; date: Date; size: number }> {
    const decompressHandlers = await loadDecompressHandlers();
    const fileHandle = await open(mcapTemporaryFileName, 'r');

    const fileSize = (await fileHandle.stat()).size;
    const reader = await McapIndexedReader.Initialize({
        readable: new FileHandleReadable(fileHandle),
        decompressHandlers,
    });

    await fileHandle.close();

    const topics: Record<string, unknown>[] = [];
    const stats: any = reader.statistics;
    const duration = BigInt(stats.messageEndTime - stats.messageStartTime);
    for (const channel of reader.channelsById) {
        //@ts-ignore
        const schema: any = reader.schemasById.get(channel.schemaId);
        //@ts-ignore
        const nrMessages = stats.channelMessageCounts.get(channel.id);
        const topic = {
            //@ts-ignore
            name: channel.topic,
            type: schema.name,
            nrMessages: nrMessages,
            frequency:
                Number(nrMessages) / (Number(duration / 1000n) / 1_000_000),
        };
        topics.push(topic);
    }

    return {
        topics: topics,
        date: new Date(Number(stats.messageStartTime / 1_000_000n)),
        size: fileSize,
    };
}
