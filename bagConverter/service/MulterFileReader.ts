// Adapter class for Express.Multer.File
import { Filelike } from '@foxglove/rosbag';

export default class MulterFileReader implements Filelike {
  private _file: Express.Multer.File;
  private _buffer: Buffer;

  constructor(file: Express.Multer.File) {
    this._file = file;
    // Assuming the file is held in memory and available as a Buffer
    this._buffer = file.buffer;
  }

  async close(): Promise<void> {
    // In-memory files don't require explicit closing,
    // but you might implement cleanup here if needed.
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    if (offset + length > this._buffer.length) {
      throw new Error(`Attempted to read beyond buffer boundaries`);
    }

    // Return a slice of the buffer based on offset and length
    return this._buffer.slice(offset, offset + length);
  }

  size(): number {
    return this._buffer.length;
  }
}
