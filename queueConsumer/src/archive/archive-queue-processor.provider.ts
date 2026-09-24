import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import {
    ArchivedFileEntry,
    ProjectArchiveEntity,
} from '@kleinkram/backend-common/entities/project/project-archive.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import environment from '@kleinkram/backend-common/environment';
import {
    ARCHIVE_QUEUE,
    ArchiveStorage,
    FilesystemArchiveStorage,
    planArchiveParts,
} from '@kleinkram/backend-common/modules/archive-storage/archive-storage';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { ProjectArchiveJobState, ProjectArchiveState } from '@kleinkram/shared';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bull';
import { createHash, Hash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import tar from 'tar-stream';
import { Repository } from 'typeorm';
import logger from '../logger';
import {
    ArchiveContext,
    MANIFEST_FILE,
    manifestYaml,
    PART_METADATA_FILE,
    partMetadataYaml,
} from './archive-metadata';

/** How often to check whether the archive storage sealed the parts. */
const SEAL_POLL_MS = 10_000;

interface ArchiveJob {
    archiveUuid: string;
}

/** Hashes and counts whatever flows through it. */
class Digest extends Transform {
    readonly md5: Hash = createHash('md5');
    readonly sha256: Hash = createHash('sha256');
    bytes = 0;

    constructor(private readonly onBytes?: (bytes: number) => void) {
        super();
    }

    add(chunk: Buffer): void {
        this.md5.update(chunk);
        this.sha256.update(chunk);
        this.bytes += chunk.length;
        this.onBytes?.(chunk.length);
    }

    override _transform(
        chunk: Buffer,
        _encoding: BufferEncoding,
        callback: (error?: Error | null, data?: Buffer) => void,
    ): void {
        this.add(chunk);
        callback(null, chunk);
    }
}

/** Passes the chunks of `source` through while feeding them to `digest`. */
async function* digested(
    source: AsyncIterable<unknown>,
    digest: Digest,
): AsyncGenerator<Buffer> {
    for await (const chunk of source) {
        const buffer = chunk as Buffer;
        digest.add(buffer);
        yield buffer;
    }
}

async function sha256Of(stream: Readable): Promise<string> {
    const digest = new Digest();
    const sink = new Writable({
        write(_chunk, _encoding, callback): void {
            callback();
        },
    });
    await pipeline(stream, digest, sink);
    return digest.sha256.digest('hex');
}

/**
 * Streams `source` into a new tar entry. tar-stream builds on streamx, so
 * its streams are piped rather than handed to `stream.pipeline`.
 */
async function writeEntry(
    pack: tar.Pack,
    header: Partial<tar.Header> & { name: string },
    source: Readable | Buffer,
): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const done = (error?: Error | null): void => {
            if (error) reject(error);
            else resolve();
        };
        if (Buffer.isBuffer(source)) {
            pack.entry(header, source, done);
            return;
        }
        const entry = pack.entry(header, done);
        source.on('error', reject);
        source.pipe(entry);
    });
}

/** Name of the n-th (0 based) tar part of an archive. */
const partName = (index: number): string =>
    `part-${String(index + 1).padStart(4, '0')}.tar`;

/** Tar entry names are not limited, but keep them portable. */
const safeName = (name: string): string =>
    name.replaceAll(/[/\\\0]/g, '_').slice(0, 200);

/**
 * Moves projects between the object storage (S3) and the archive storage.
 *
 * Archive: S3 → tar parts on the archive storage → verify → wait for the
 * seal → purge S3.
 * Restore: archive storage → local staging disk → verify → unpack → S3.
 */
@Processor(ARCHIVE_QUEUE)
@Injectable()
export class ArchiveQueueProcessorProvider {
    private readonly storage: ArchiveStorage = new FilesystemArchiveStorage();

    constructor(
        @InjectRepository(ProjectArchiveEntity)
        private readonly archiveRepository: Repository<ProjectArchiveEntity>,
        @InjectRepository(ProjectEntity)
        private readonly projectRepository: Repository<ProjectEntity>,
        @InjectRepository(FileEntity)
        private readonly fileRepository: Repository<FileEntity>,
        @InjectRepository(MissionEntity)
        private readonly missionRepository: Repository<MissionEntity>,
        @Inject('DataStorageBucket')
        private readonly dataStorage: IStorageBucket,
        @InjectQueue(ARCHIVE_QUEUE) private readonly queue: Queue,
    ) {}

    @Process({ name: 'archive-project', concurrency: 1 })
    async archiveProject(job: Job<ArchiveJob>): Promise<void> {
        const archive = await this.load(job.data.archiveUuid);
        const written: string[] = [];
        try {
            await this.pack(archive, written);
            await this.verify(archive);
            await this.setState(archive, ProjectArchiveJobState.AWAITING_SEAL);
            await this.queue.add('await-seal', job.data);
        } catch (error) {
            logger.error(`Archive ${archive.uuid} failed: ${String(error)}`);
            // Nothing was purged yet: drop the partial copy (still allowed,
            // sealed objects can be deleted) and give the project back.
            for (const key of written) {
                await this.storage.remove(key).catch((removeError: unknown) => {
                    logger.warn(
                        `Could not remove ${key}: ${String(removeError)}`,
                    );
                });
            }
            archive.error = String(error);
            await this.setState(archive, ProjectArchiveJobState.FAILED);
            await this.setProjectState(archive, ProjectArchiveState.ACTIVE);
        }
    }

    /**
     * Polls until the archive storage sealed all parts: at once with
     * `ARCHIVE_SEAL_MODE=self`, after its delay timer on storage that seals
     * objects itself (1 h on ETH LTS, a minute in the local mock).
     */
    @Process({ name: 'await-seal', concurrency: 1 })
    async awaitSeal(job: Job<ArchiveJob>): Promise<void> {
        const archive = await this.load(job.data.archiveUuid);
        const keys = archive.parts.map(
            (part) => `${archive.location}/${part.name}`,
        );
        // Archives written before the manifest moved to YAML have none
        const manifestKey = `${archive.location}/${MANIFEST_FILE}`;
        if (await this.storage.exists(manifestKey)) keys.push(manifestKey);
        const sealed = await Promise.all(
            keys.map((key) => this.storage.isSealed(key)),
        );
        if (!sealed.every(Boolean)) {
            logger.debug(
                `Archive ${archive.uuid}: ${sealed.filter(Boolean).length.toString()}/${keys.length.toString()} objects sealed`,
            );
            await this.queue.add('await-seal', job.data, {
                delay: SEAL_POLL_MS,
            });
            return;
        }

        await this.setState(archive, ProjectArchiveJobState.PURGING);
        const entries = archive.parts.flatMap((part) => part.files);
        for (const entry of entries) {
            await this.dataStorage.deleteFile(entry.fileUuid);
        }

        archive.archivedAt = new Date();
        archive.bytesProcessed = archive.totalBytes;
        await this.setState(archive, ProjectArchiveJobState.ARCHIVED);
        await this.setProjectState(archive, ProjectArchiveState.ARCHIVED);
        logger.info(
            `Archive ${archive.uuid}: ${entries.length.toString()} files moved to the archive storage`,
        );
    }

    @Process({ name: 'restore-project', concurrency: 1 })
    async restoreProject(job: Job<ArchiveJob>): Promise<void> {
        const archive = await this.load(job.data.archiveUuid);
        const staging = path.join(
            environment.ARCHIVE_STAGING_DIR,
            archive.uuid,
        );
        try {
            await this.recall(archive, staging);
            await this.unpack(archive, staging);
            archive.restoredAt = new Date();
            await this.setState(archive, ProjectArchiveJobState.RESTORED);
            await this.setProjectState(archive, ProjectArchiveState.ACTIVE);
        } catch (error) {
            logger.error(`Restore of ${archive.uuid} failed: ${String(error)}`);
            // The data is still safe on the archive storage
            archive.error = String(error);
            await this.setState(archive, ProjectArchiveJobState.FAILED);
            await this.setProjectState(archive, ProjectArchiveState.ARCHIVED);
        } finally {
            await fs.rm(staging, { recursive: true, force: true });
        }
    }

    private async pack(
        archive: ProjectArchiveEntity,
        written: string[],
    ): Promise<void> {
        await this.setState(archive, ProjectArchiveJobState.PACKING);
        const context = await this.loadContext(archive);
        const files = [...context.files.values()];

        // Only what is actually in S3 can be archived
        const present: { file: FileEntity; size: number }[] = [];
        for (const file of files) {
            const stat = await this.dataStorage.getFileInfo(file.uuid);
            if (stat) present.push({ file, size: stat.size });
            else logger.warn(`Archive ${archive.uuid}: ${file.uuid} not in S3`);
        }

        const groups = planArchiveParts(present);
        context.partNames = groups.map((_group, index) => partName(index));

        archive.fileCount = present.length;
        archive.totalBytes = present.reduce((sum, item) => sum + item.size, 0);
        archive.bytesProcessed = 0;
        archive.parts = [];
        await this.archiveRepository.save(archive);

        const usedPaths = new Set<string>([PART_METADATA_FILE]);
        let lastSave = Date.now();
        for (const [index, group] of groups.entries()) {
            const name = partName(index);
            const key = `${archive.location}/${name}`;
            const upload = await this.storage.upload(key);
            written.push(key);
            const partDigest = new Digest();
            const pack = tar.pack();
            const done = pipeline(
                Readable.from(pack),
                partDigest,
                upload.stream,
            );

            const entries: ArchivedFileEntry[] = [];
            for (const { file, size } of group) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- loaded above
                const mission = file.mission!;
                let entryPath = `${safeName(mission.name)}/${safeName(file.filename)}`;
                if (usedPaths.has(entryPath)) {
                    entryPath = `${safeName(mission.name)}-${mission.uuid}/${safeName(file.filename)}`;
                }
                usedPaths.add(entryPath);

                const digest = new Digest((bytes) => {
                    archive.bytesProcessed += bytes;
                });
                const source = await this.dataStorage.getFileStream(file.uuid);
                source.on('error', (error) => digest.destroy(error));
                await writeEntry(
                    pack,
                    { name: entryPath, size, mtime: file.date },
                    source.pipe(digest),
                );
                entries.push({
                    fileUuid: file.uuid,
                    missionUuid: mission.uuid,
                    filename: file.filename,
                    path: entryPath,
                    size,
                    md5: digest.md5.digest('base64'),
                    sha256: digest.sha256.digest('hex'),
                });
                if (Date.now() - lastSave > 1000) {
                    lastSave = Date.now();
                    await this.archiveRepository.update(archive.uuid, {
                        bytesProcessed: archive.bytesProcessed,
                    });
                }
            }
            // Last entry, so that the checksums of the files are known
            await writeEntry(
                pack,
                { name: PART_METADATA_FILE, mtime: new Date() },
                Buffer.from(
                    partMetadataYaml(
                        context,
                        { name, index, count: groups.length },
                        entries,
                    ),
                ),
            );
            pack.finalize();
            await done;
            await upload.commit();

            archive.parts.push({
                name,
                size: partDigest.bytes,
                sha256: partDigest.sha256.digest('hex'),
                files: entries,
            });
            await this.archiveRepository.save(archive);
        }

        const manifestKey = `${archive.location}/${MANIFEST_FILE}`;
        await this.storage.writeFile(
            manifestKey,
            manifestYaml(context, archive.parts),
        );
        written.push(manifestKey);
    }

    private async loadContext(
        archive: ProjectArchiveEntity,
    ): Promise<ArchiveContext> {
        const projectUuid = archive.project?.uuid ?? '';
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUuid },
        });
        const missions = await this.missionRepository.find({
            where: { project: { uuid: projectUuid } },
            relations: { metadata: { metadataType: true } },
            order: { name: 'ASC' },
        });
        const files = await this.fileRepository.find({
            where: { mission: { project: { uuid: projectUuid } } },
            relations: { mission: true, topics: true, categories: true },
            order: { mission: { name: 'ASC' }, filename: 'ASC' },
        });
        return {
            archive,
            project,
            missions,
            files: new Map(files.map((file) => [file.uuid, file])),
            partNames: [],
        };
    }

    /** Re-reads every part while it is still in the disk cache. */
    private async verify(archive: ProjectArchiveEntity): Promise<void> {
        await this.setState(archive, ProjectArchiveJobState.VERIFYING);
        for (const part of archive.parts) {
            const sha256 = await sha256Of(
                this.storage.read(`${archive.location}/${part.name}`),
            );
            if (sha256 !== part.sha256) {
                throw new Error(`Checksum mismatch in ${part.name}`);
            }
        }
    }

    private async recall(
        archive: ProjectArchiveEntity,
        staging: string,
    ): Promise<void> {
        await this.setState(archive, ProjectArchiveJobState.RECALLING);
        let done = 0;
        for (const part of archive.parts) {
            const destination = path.join(staging, part.name);
            await this.storage.recall(
                `${archive.location}/${part.name}`,
                destination,
                (bytes) => {
                    archive.bytesProcessed = done + bytes;
                },
            );
            done += part.size;
            const sha256 = await sha256Of(createReadStream(destination));
            if (sha256 !== part.sha256) {
                throw new Error(`Checksum mismatch in recalled ${part.name}`);
            }
            await this.archiveRepository.update(archive.uuid, {
                bytesProcessed: done,
            });
        }
    }

    private async unpack(
        archive: ProjectArchiveEntity,
        staging: string,
    ): Promise<void> {
        archive.bytesProcessed = 0;
        await this.setState(archive, ProjectArchiveJobState.UNPACKING);
        const projectUuid = archive.project?.uuid ?? '';

        for (const part of archive.parts) {
            const byPath = new Map(
                part.files.map((entry) => [entry.path, entry]),
            );
            const extract = tar.extract();
            const source = path.join(staging, part.name);

            const finished = new Promise<void>((resolve, reject) => {
                extract.on('entry', (header, stream, next) => {
                    const entry = byPath.get(header.name);
                    if (!entry) {
                        stream.resume();
                        stream.on('end', next);
                        return;
                    }
                    this.restoreEntry(projectUuid, entry, stream)
                        .then(async () => {
                            archive.bytesProcessed += entry.size;
                            await this.archiveRepository.update(archive.uuid, {
                                bytesProcessed: archive.bytesProcessed,
                            });
                            next();
                        })
                        .catch(reject);
                });
                extract.on('finish', resolve);
                extract.on('error', reject);
            });
            createReadStream(source).pipe(extract);
            await finished;
            await fs.rm(source, { force: true });
        }
    }

    private async restoreEntry(
        projectUuid: string,
        entry: ArchivedFileEntry,
        stream: AsyncIterable<unknown>,
    ): Promise<void> {
        // Streamed straight into S3 in parts: no temporary copy, bounded
        // memory, and files larger than 5 GB work. The upload is only
        // completed once the checksum matches, otherwise it is aborted.
        const digest = new Digest();
        await this.dataStorage.uploadStream(
            entry.fileUuid,
            digested(stream, digest),
            {
                sizeHint: entry.size,
                beforeComplete: () => {
                    if (digest.md5.digest('base64') !== entry.md5) {
                        throw new Error(`Checksum mismatch for ${entry.path}`);
                    }
                },
            },
        );
        await this.dataStorage.addTags(entry.fileUuid, {
            projectUuid,
            missionUuid: entry.missionUuid,
            filename: entry.filename,
        });
    }

    private async load(uuid: string): Promise<ProjectArchiveEntity> {
        return this.archiveRepository.findOneOrFail({
            where: { uuid },
            relations: { project: true },
        });
    }

    private async setState(
        archive: ProjectArchiveEntity,
        state: ProjectArchiveJobState,
    ): Promise<void> {
        archive.state = state;
        await this.archiveRepository.update(archive.uuid, {
            state,
            error: archive.error ?? null,
            bytesProcessed: archive.bytesProcessed,
            archivedAt: archive.archivedAt ?? null,
            restoredAt: archive.restoredAt ?? null,
        });
    }

    private async setProjectState(
        archive: ProjectArchiveEntity,
        state: ProjectArchiveState,
    ): Promise<void> {
        if (!archive.project) return;
        await this.projectRepository.update(archive.project.uuid, {
            archiveState: state,
        });
    }
}
