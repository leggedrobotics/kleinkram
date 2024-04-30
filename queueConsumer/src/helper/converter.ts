import { loadDecompressHandlers } from '@mcap/support';
import { McapIndexedReader } from '@mcap/core';
import { IReadable } from '@mcap/core/dist/cjs/src/types';

import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs';
import logger from '../logger';

const execPromisify = promisify(exec);


export async function convert(infile: string, outfile: string): Promise<Buffer> {
  // Convert file
  await execPromisify(`mcap convert ${infile} ${outfile}`);

  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(outfile);
    const buffers = [];

    readStream.on('data', (chunk) => {
      buffers.push(chunk);
    });

    readStream.on('end', () => {
      // Concatenate all chunks into a single Buffer
      const fullBuffer = Buffer.concat(buffers);
      logger.debug('File reading complete. Buffer size:', fullBuffer.length);
      resolve(fullBuffer); // Resolve the promise with the full buffer
    });

    readStream.on('error', (error) => {
      logger.error('Error reading the file:', error);
      reject(error); // Reject the promise on read error
    });
  });
}


export async function mcapMetaInfo(buffer: Buffer) {
  const decompressHandlers = await loadDecompressHandlers();
  const readable = new BufferReadable(buffer);
  const reader = await McapIndexedReader.Initialize({
    readable,
    decompressHandlers
  });

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
      frequency: Number(nr_messages) / (Number(duration / 1000n) / 1000000)
    };
    topics.push(topic);
  });

  return {
    topics: topics,
    date: new Date(Number(stats.messageStartTime / 1000000n)),
    size: buffer.length
  };
}

class BufferReadable implements IReadable {
  constructor(private buffer: Buffer) {
  }

  async size(): Promise<bigint> {
    return BigInt(this.buffer.length);
  }

  async read(offset: bigint, size: bigint): Promise<Uint8Array> {
    // Convert bigint to number for Buffer operations; ensure this doesn't exceed Number.MAX_SAFE_INTEGER
    const start = Number(offset);
    const end = start + Number(size);
    // Slice the buffer to get the specified portion; convert to Uint8Array as expected by the interface
    return new Uint8Array(this.buffer.slice(start, end));
  }
}