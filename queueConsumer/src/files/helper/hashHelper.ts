import * as crypto from 'crypto';
import * as fs from 'fs';

export async function calculateFileHash(
    filePath: string,
    algorithm = 'md5',
): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash(algorithm);
        const fileStream = fs.createReadStream(filePath);

        fileStream.on('data', (chunk) => {
            hash.update(chunk); // Update hash with each chunk of data
        });

        fileStream.on('end', () => {
            const fileHash = hash.digest('base64'); // Finalize the hash calculation
            resolve(fileHash);
        });

        fileStream.on('error', (err) => {
            reject(err);
        });
    });
}
