import { McapIndexedReader } from '@mcap/core';
import { loadDecompressHandlers } from '@mcap/support';

import Topic from '@common/entities/topic/topic.entity';
import { FileHandleReadable } from '@mcap/nodejs';
import { exec } from 'node:child_process';
import { open } from 'node:fs/promises';
import { promisify } from 'node:util';
import logger from '../../logger';
import { traceWrapper } from '../../tracing';

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
): Promise<{ topics: Partial<Topic>[]; date: Date; size: number }> {
    const decompressHandlers = await loadDecompressHandlers();
    const fileHandle = await open(mcapTemporaryFileName, 'r');

    const { size: fileSize } = await fileHandle.stat();
    const reader = await McapIndexedReader.Initialize({
        readable: new FileHandleReadable(fileHandle),
        decompressHandlers,
    });

    await fileHandle.close();

    const topics: Partial<Topic>[] = [];
    const stats = reader.statistics;

    if (stats === undefined) {
        logger.debug('No Messages Found');
        return {
            topics: [],
            date: new Date(),
            size: fileSize,
        };
    }

    const duration = stats.messageEndTime - stats.messageStartTime;
    for (const enumeratedChannel of reader.channelsById) {
        const channel = enumeratedChannel[1];

        logger.debug(JSON.stringify(channel));
        const schema = reader.schemasById.get(channel.schemaId);

        if (schema === undefined) continue;

        const nrMessages = stats.channelMessageCounts.get(channel.id);
        const topic: Partial<Topic> = {
            name: channel.topic,
            type: schema.name,
            nrMessages: nrMessages ?? 0n,
            messageEncoding: channel.messageEncoding,
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
