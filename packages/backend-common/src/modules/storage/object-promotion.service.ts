import {
    AbortMultipartUploadCommand,
    CompletedPart,
    CompleteMultipartUploadCommand,
    CopyObjectCommand,
    CreateMultipartUploadCommand,
    DeleteObjectCommand,
    S3Client,
    UploadPartCopyCommand,
} from '@aws-sdk/client-s3';
import environment from '@backend-common/environment';
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Prefix uploads land under before they are promoted.
 *
 * It has to live in the same bucket as the promoted object: SeaweedFS refuses
 * to rename across buckets (`weed/filer/filer_rename.go`, "can not move across
 * collection"), and a rename is the only way to promote an object without
 * re-writing every one of its chunks.
 */
export const UPLOAD_STAGING_PREFIX = 'uploads/';

/**
 * Path under which the SeaweedFS filer exposes S3 buckets. The entrypoint in
 * `docker/seaweedfs-entrypoint.sh` creates the buckets below this prefix.
 */
const FILER_BUCKETS_PATH = '/buckets';

const FILER_DEFAULT_PORT = 8888;

/** A single CopyObject cannot exceed 5 GiB, larger objects need UploadPartCopy. */
const MAX_SINGLE_COPY_BYTES = 5 * 1024 * 1024 * 1024;

/** Part size for the multipart fallback; 10 000 parts cover 10 TiB. */
const COPY_PART_BYTES = 1024 * 1024 * 1024;

/**
 * Moves an uploaded object from the key a client can write to the key it is
 * served from.
 *
 * This is what makes an upload immutable. The STS credentials handed to a
 * client are scoped to a single staging key, and SeaweedFS issues them as
 * stateless JWTs that cannot be revoked, so they stay usable until they
 * expire. Once the object no longer lives at that key, the credentials point
 * at nothing and the content that was hashed and validated can no longer
 * change.
 */
@Injectable()
export class ObjectPromotionService {
    private readonly logger = new Logger(ObjectPromotionService.name);
    private warnedAboutFiler = false;

    async promote(
        client: S3Client,
        bucket: string,
        sourceKey: string,
        destinationKey: string,
        sizeBytes: number,
    ): Promise<void> {
        if (await this.renameViaFiler(bucket, sourceKey, destinationKey))
            return;

        // The filer is a SeaweedFS extension. Any other S3 implementation has
        // to pay for a real copy, which is why this is only the fallback.
        this.logger.warn(
            `Promoting ${destinationKey} with a server-side copy of ${sizeBytes.toString()} bytes ` +
                `because the SeaweedFS filer is unavailable`,
        );
        await this.copyAndDelete(
            client,
            bucket,
            sourceKey,
            destinationKey,
            sizeBytes,
        );
    }

    /**
     * Renames the object through the SeaweedFS filer, for which buckets are
     * directories. This is an atomic metadata operation that costs the same
     * for a 1 KiB file and a 1 TiB file.
     *
     * @param bucket - bucket holding both keys
     * @param sourceKey - key to move away from
     * @param destinationKey - key to move to
     * @returns whether the rename succeeded
     */
    private async renameViaFiler(
        bucket: string,
        sourceKey: string,
        destinationKey: string,
    ): Promise<boolean> {
        const filerEndpoint = this.filerEndpoint();
        if (filerEndpoint === undefined) return false;

        const bucketPath = `${FILER_BUCKETS_PATH}/${bucket}`;
        const destination = `${filerEndpoint}${bucketPath}/${encodeURIComponent(destinationKey)}`;

        try {
            await axios.post(destination, undefined, {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                params: { 'mv.from': `${bucketPath}/${sourceKey}` },
                timeout: 30_000,
            });
            return true;
        } catch (error: unknown) {
            if (!this.warnedAboutFiler) {
                this.warnedAboutFiler = true;
                this.logger.warn(
                    `SeaweedFS filer at ${filerEndpoint} cannot be used to promote uploads, ` +
                        `falling back to server-side copies: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                );
            }
            return false;
        }
    }

    /**
     * @returns the filer base url, or undefined when none can be derived
     */
    private filerEndpoint(): string | undefined {
        const configured =
            environment.S3_FILER_ENDPOINT ?? environment.S3_ENDPOINT_INTERNAL;
        if (configured === undefined) return undefined;

        const withProtocol = configured.includes('://')
            ? configured
            : `http://${configured}`;

        try {
            const url = new URL(withProtocol);
            // The internal S3 endpoint points at the S3 gateway; the filer of
            // the same server listens on its own port.
            if (environment.S3_FILER_ENDPOINT === undefined) {
                url.port = FILER_DEFAULT_PORT.toString();
            }
            return url.toString().replace(/\/$/, '');
        } catch {
            return undefined;
        }
    }

    private async copyAndDelete(
        client: S3Client,
        bucket: string,
        sourceKey: string,
        destinationKey: string,
        sizeBytes: number,
    ): Promise<void> {
        if (sizeBytes > MAX_SINGLE_COPY_BYTES) {
            await this.multipartCopy(
                client,
                bucket,
                sourceKey,
                destinationKey,
                sizeBytes,
            );
        } else {
            await client.send(
                new CopyObjectCommand({
                    Bucket: bucket,
                    Key: destinationKey,
                    CopySource: `${bucket}/${sourceKey}`,
                }),
            );
        }

        await client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }),
        );
    }

    private async multipartCopy(
        client: S3Client,
        bucket: string,
        sourceKey: string,
        destinationKey: string,
        sizeBytes: number,
    ): Promise<void> {
        const { UploadId: uploadId } = await client.send(
            new CreateMultipartUploadCommand({
                Bucket: bucket,
                Key: destinationKey,
            }),
        );
        if (uploadId === undefined)
            throw new Error(
                `Storage did not return an upload id while promoting ${destinationKey}`,
            );

        try {
            const parts: CompletedPart[] = [];
            for (
                let partNumber = 1, start = 0;
                start < sizeBytes;
                partNumber++, start += COPY_PART_BYTES
            ) {
                const end = Math.min(start + COPY_PART_BYTES, sizeBytes) - 1;
                const part = await client.send(
                    new UploadPartCopyCommand({
                        Bucket: bucket,
                        Key: destinationKey,
                        UploadId: uploadId,
                        PartNumber: partNumber,
                        CopySource: `${bucket}/${sourceKey}`,
                        CopySourceRange: `bytes=${start.toString()}-${end.toString()}`,
                    }),
                );
                parts.push({
                    ETag: part.CopyPartResult?.ETag,
                    PartNumber: partNumber,
                });
            }

            await client.send(
                new CompleteMultipartUploadCommand({
                    Bucket: bucket,
                    Key: destinationKey,
                    UploadId: uploadId,
                    MultipartUpload: { Parts: parts },
                }),
            );
        } catch (error: unknown) {
            await client
                .send(
                    new AbortMultipartUploadCommand({
                        Bucket: bucket,
                        Key: destinationKey,
                        UploadId: uploadId,
                    }),
                )
                .catch((abortError: unknown) => {
                    this.logger.error(
                        `Failed to abort the promotion of ${destinationKey}: ${String(abortError)}`,
                    );
                });
            throw error;
        }
    }
}
