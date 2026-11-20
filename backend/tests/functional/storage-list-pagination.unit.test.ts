import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { S3StorageBucket } from '@kleinkram/backend-common/modules/storage/s3-storage-bucket';

/** One `ListObjectsV2` page of `count` objects named `<prefix>-<n>`. */
const page = (prefix: string, count: number, next?: string) => ({
    Contents: Array.from({ length: count }, (_, index) => ({
        Key: `${prefix}-${index.toString()}`,
        Size: 1,
    })),
    IsTruncated: next !== undefined,
    NextContinuationToken: next,
});

describe('Storage Listing', () => {
    test('should list every object, not only the first 1000', async () => {
        const pages = [
            page('a', 1000, 'token-1'),
            page('b', 1000, 'token-2'),
            page('c', 3),
        ];
        const tokens: (string | undefined)[] = [];
        const send = jest.fn((command: ListObjectsV2Command) => {
            tokens.push(command.input.ContinuationToken);
            return Promise.resolve(pages.shift());
        });
        // only the parts `listFiles` uses
        const bucket = Object.assign(
            Object.create(S3StorageBucket.prototype) as object,
            { bucketName: 'data', clients: { internal: { send } } },
        ) as unknown as S3StorageBucket;

        const objects = await bucket.listFiles();

        expect(objects).toHaveLength(2003);
        expect(tokens).toEqual([undefined, 'token-1', 'token-2']);
    });
});
