import {
    AbortMultipartUploadCommand,
    CreateMultipartUploadCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import environment from '../../../packages/backend-common/src/environment';
import { StorageAuthService } from '../../../packages/backend-common/src/modules/storage/storage-auth.service';

describe('StorageAuthService - STS Security Enforcement (Integration)', () => {
    let authService: StorageAuthService;
    let moduleReference: TestingModule;

    beforeAll(async () => {
        // Compile the module context for the environments
        process.env.S3_ENDPOINT = 'http://localhost:9000';
        process.env.S3_ENDPOINT_INTERNAL = 'http://localhost:9000';
        process.env.S3_DATA_BUCKET_NAME = 'data';

        moduleReference = await Test.createTestingModule({
            imports: [ConfigModule.forRoot()],
            providers: [StorageAuthService],
        }).compile();

        authService =
            moduleReference.get<StorageAuthService>(StorageAuthService);
    });

    afterAll(async () => {
        await moduleReference.close();
    });

    describe('generateTemporaryCredential()', () => {
        it('should successfully return credentials with a valid session token', async () => {
            const bucket = environment.S3_DATA_BUCKET_NAME || 'data';
            const filename = 'test-action-logs-001.txt';

            const creds = await authService.generateTemporaryCredential(
                filename,
                bucket,
            );

            expect(creds.accessKey).toBeDefined();
            expect(creds.secretKey).toBeDefined();
            expect(creds.sessionToken).toBeDefined();
            expect(creds.sessionToken.length).toBeGreaterThan(0);
        });

        it('should allow putting an object with the scoped credentials, but deny deleting', async () => {
            const bucket = environment.S3_DATA_BUCKET_NAME || 'data';
            const filename = `integration-test-sts-${Date.now().toString()}.txt`;

            // 1. Get the highly scoped credentials from the service
            const creds = await authService.generateTemporaryCredential(
                filename,
                bucket,
            );

            // 2. Initialize an S3 Client using ONLY the temporary credentials
            const s3Client = new S3Client({
                endpoint:
                    environment.S3_ENDPOINT_INTERNAL ?? environment.S3_ENDPOINT,
                region: environment.S3_REGION ?? 'us-east-1',
                credentials: {
                    accessKeyId: creds.accessKey,
                    secretAccessKey: creds.secretKey,
                    sessionToken: creds.sessionToken,
                },
                forcePathStyle: true, // Necessary for SeaweedFS/MinIO
            });

            // 3. Positive Test: Putting the exact object should succeed
            const putCommand = new PutObjectCommand({
                Bucket: bucket,
                Key: filename,
                Body: Buffer.from('STS verification test data'),
            });

            await expect(s3Client.send(putCommand)).resolves.not.toThrow();

            // 4. Negative Test: Deleting the exact object should FAIL (not in the STS Policy)
            const deleteCommand = new DeleteObjectCommand({
                Bucket: bucket,
                Key: filename,
            });

            await expect(s3Client.send(deleteCommand)).rejects.toThrow(
                /Access ?Denied|Forbidden/i,
            );

            // 5. Negative Test: Putting a DIFFERENT object should FAIL (not in the Resource ARN Policy)
            const putOtherCommand = new PutObjectCommand({
                Bucket: bucket,
                Key: 'some-other-filename.txt',
                Body: Buffer.from('Should fail'),
            });

            await expect(s3Client.send(putOtherCommand)).rejects.toThrow(
                /Access ?Denied|Forbidden/i,
            );

            // 6. Negative Test: Getting the exact object should FAIL (not in the STS Policy)
            const getCommand = new GetObjectCommand({
                Bucket: bucket,
                Key: filename,
            });

            await expect(s3Client.send(getCommand)).rejects.toThrow(
                /Access ?Denied|Forbidden/i,
            );

            // 7. Positive Test: Create/Abort Multipart Upload for the exact object should SUCCEED
            const createMpCommand = new CreateMultipartUploadCommand({
                Bucket: bucket,
                Key: filename,
            });

            const createResponse = await s3Client.send(createMpCommand);
            expect(createResponse.UploadId).toBeDefined();

            if (createResponse.UploadId) {
                const abortMpCommand = new AbortMultipartUploadCommand({
                    Bucket: bucket,
                    Key: filename,
                    UploadId: createResponse.UploadId,
                });
                await expect(
                    s3Client.send(abortMpCommand),
                ).resolves.not.toThrow();
            }
        });
    });
});
