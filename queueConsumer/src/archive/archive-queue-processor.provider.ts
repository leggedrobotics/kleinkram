import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import {
    ArchivedFileEntry,
    PlannedPart,
    ProjectArchiveEntity,
} from '@kleinkram/backend-common/entities/project/project-archive.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import environment from '@kleinkram/backend-common/environment';
import {
    ARCHIVE_ADVANCE_JOB,
    ARCHIVE_QUEUE,
    archiveJobOptions,
    ArchiveStorage,
    FilesystemArchiveStorage,
    planArchiveParts,
} from '@kleinkram/backend-common/modules/archive-storage/archive-storage';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { ProjectArchiveJobState, ProjectArchiveState } from '@kleinkram/shared';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bull';
import { createHash, Hash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import tar from 'tar-stream';
import { DataSource, In, Repository } from 'typeorm';
import logger from '../logger';
import {
    ArchiveContext,
    MANIFEST_FILE,
    manifestYaml,
    PART_METADATA_FILE,
    partMetadataYaml,
} from './archive-metadata';

/** How long a consumer may work on an archive without renewing its lease. */
const LEASE_MS = 2 * 60 * 1000;
const LEASE_RENEW_MS = 30 * 1000;

/** Identifies this consumer process in the lease. */
const LEASE_OWNER = `${os.hostname()}:${process.pid.toString()}:${randomUUID()}`;

/** States in which an archive still has work to do. */
const UNFINISHED_STATES = [
    ProjectArchiveJobState.QUEUED,
    ProjectArchiveJobState.PACKING,
    ProjectArchiveJobState.VERIFYING,
    ProjectArchiveJobState.AWAITING_SEAL,
    ProjectArchiveJobState.PURGING,
    ProjectArchiveJobState.RECALLING,
    ProjectArchiveJobState.UNPACKING,
];

/** Before this point nothing was removed from S3; the project can go back. */
const REVERSIBLE_STATES = new Set([
    ProjectArchiveJobState.QUEUED,
    ProjectArchiveJobState.PACKING,
    ProjectArchiveJobState.VERIFYING,
    ProjectArchiveJobState.AWAITING_SEAL,
]);

const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;

interface ArchiveJob {
    archiveUuid: string;
}

/** Delay before an archive whose last run failed is tried again. */
const retryDelayMs = (attempts: number): number =>
    Math.min(
        environment.ARCHIVE_RETRY_DELAY_SECONDS *
            1000 *
            2 ** Math.max(0, attempts - 1),
        MAX_RETRY_DELAY_MS,
    );

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
 * Archive: QUEUED → PACKING → VERIFYING → AWAITING_SEAL → PURGING → ARCHIVED
 * Restore: RECALLING ⇄ UNPACKING (part by part) → RESTORED
 *
 * Kleinkram must never lose data, so the state in the database is the only
 * source of truth and every phase can be interrupted at any point:
 *
 * - Jobs only say "advance this archive". A reconciler re-queues every
 *   unfinished archive on start-up and every 30 s, so a crashed consumer, a
 *   lost job or a flushed Redis just delays the work.
 * - Every phase is idempotent and resumes where it stopped: the layout of the
 *   archive is planned before the first byte is written, finished parts are
 *   skipped, purging and uploading can be repeated.
 * - A per-archive database lock keeps two consumers off the same archive.
 * - A phase is tried ARCHIVE_MAX_ATTEMPTS times with growing delays. Before
 *   PURGING, giving up removes the partial copy and hands the project back
 *   with its data untouched in S3. From PURGING on there is no way back and
 *   no giving up: purging is retried until S3 is clean. A failed restore
 *   leaves the project archived.
 * - S3 is only purged once every part was re-read and matched its checksum,
 *   every archived file matched the hash Kleinkram knew for it, and the
 *   archive storage sealed every part.
 */
@Processor(ARCHIVE_QUEUE)
@Injectable()
export class ArchiveQueueProcessorProvider implements OnApplicationBootstrap {
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
        private readonly dataSource: DataSource,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        await this.reconcile();
    }

    /**
     * Makes sure every unfinished archive has a job, except those waiting
     * for their retry delay.
     */
    @Cron(CronExpression.EVERY_30_SECONDS)
    async reconcile(): Promise<void> {
        const archives = await this.archiveRepository.find({
            where: { state: In(UNFINISHED_STATES) },
            select: {
                uuid: true,
                attempts: true,
                error: true,
                updatedAt: true,
            },
        });
        for (const archive of archives) {
            const waiting =
                archive.error &&
                archive.updatedAt.getTime() + retryDelayMs(archive.attempts) >
                    Date.now();
            if (waiting) continue;
            // The job id makes this a no-op while a job for it is queued
            await this.queue
                .add(
                    ARCHIVE_ADVANCE_JOB,
                    { archiveUuid: archive.uuid },
                    archiveJobOptions(archive.uuid),
                )
                .catch((error: unknown) => {
                    logger.error(
                        `Could not queue archive ${archive.uuid}: ${String(error)}`,
                    );
                });
        }
    }

    @Process({ name: ARCHIVE_ADVANCE_JOB, concurrency: 1 })
    async advance(job: Job<ArchiveJob>): Promise<void> {
        const { archiveUuid } = job.data;
        if (!(await this.acquireLease(archiveUuid))) {
            logger.debug(
                `Archive ${archiveUuid} is leased by another consumer`,
            );
            return;
        }
        const renewal = setInterval(() => {
            void this.acquireLease(archiveUuid).then((renewed) => {
                if (!renewed) {
                    // Only if this process stalled for longer than the lease
                    logger.error(`Lost the lease on archive ${archiveUuid}`);
                }
            });
        }, LEASE_RENEW_MS);
        try {
            await this.drive(archiveUuid);
        } finally {
            clearInterval(renewal);
            await this.archiveRepository
                .createQueryBuilder()
                .update()
                .set({ leaseOwner: null, leaseUntil: null })
                .where('uuid = :uuid AND "leaseOwner" = :owner', {
                    uuid: archiveUuid,
                    owner: LEASE_OWNER,
                })
                .execute();
        }
    }

    /** Takes or renews the lease; atomic, so only one consumer gets it. */
    private async acquireLease(archiveUuid: string): Promise<boolean> {
        const result = await this.archiveRepository
            .createQueryBuilder()
            .update()
            .set({
                leaseOwner: LEASE_OWNER,
                leaseUntil: () =>
                    `now() + interval '${(LEASE_MS / 1000).toString()} seconds'`,
            })
            .where(
                'uuid = :uuid AND ("leaseUntil" IS NULL OR "leaseUntil" < now() OR "leaseOwner" = :owner)',
                { uuid: archiveUuid, owner: LEASE_OWNER },
            )
            .execute();
        return (result.affected ?? 0) > 0;
    }

    /** Runs phases until the archive is done, waiting or failed. */
    private async drive(archiveUuid: string): Promise<void> {
        const archive = await this.load(archiveUuid);
        if (!UNFINISHED_STATES.includes(archive.state)) return;

        const maxAttempts = environment.ARCHIVE_MAX_ATTEMPTS;
        if (
            archive.attempts >= maxAttempts &&
            archive.state !== ProjectArchiveJobState.PURGING
        ) {
            await this.giveUp(archive);
            return;
        }

        // Counted before the work, so that a phase that kills the consumer
        // (out of memory, say) is bounded too
        archive.attempts += 1;
        await this.archiveRepository.update(archive.uuid, {
            attempts: archive.attempts,
        });

        try {
            while (UNFINISHED_STATES.includes(archive.state)) {
                const next = await this.runPhase(archive);
                if (next === undefined) return; // waiting, try again later
                // This run goes on with the next phase and counts as its
                // first attempt, so a crash there is bounded as well
                archive.attempts = 1;
                archive.error = null;
                await this.setState(archive, next);
            }
        } catch (error) {
            archive.error = `${archive.state}: ${String(error)}`;
            logger.error(
                `Archive ${archive.uuid}, attempt ${archive.attempts.toString()}: ${archive.error}`,
            );
            await this.archiveRepository.update(archive.uuid, {
                error: archive.error,
            });
            if (
                archive.attempts >= maxAttempts &&
                archive.state !== ProjectArchiveJobState.PURGING
            ) {
                await this.giveUp(archive);
            }
        }
    }

    /**
     * Does the work of the current state.
     *
     * @returns the next state, or undefined if the archive has to wait
     */
    private async runPhase(
        archive: ProjectArchiveEntity,
    ): Promise<ProjectArchiveJobState | undefined> {
        switch (archive.state) {
            case ProjectArchiveJobState.QUEUED: {
                return ProjectArchiveJobState.PACKING;
            }
            case ProjectArchiveJobState.PACKING: {
                await this.pack(archive);
                return ProjectArchiveJobState.VERIFYING;
            }
            case ProjectArchiveJobState.VERIFYING: {
                await this.verify(archive);
                return ProjectArchiveJobState.AWAITING_SEAL;
            }
            case ProjectArchiveJobState.AWAITING_SEAL: {
                if (!(await this.allSealed(archive))) {
                    // Waiting is not failing
                    archive.attempts = 0;
                    await this.archiveRepository.update(archive.uuid, {
                        attempts: 0,
                    });
                    return undefined;
                }
                return ProjectArchiveJobState.PURGING;
            }
            case ProjectArchiveJobState.PURGING: {
                await this.purge(archive);
                return ProjectArchiveJobState.ARCHIVED;
            }
            case ProjectArchiveJobState.RECALLING:
            case ProjectArchiveJobState.UNPACKING: {
                await this.restore(archive);
                return ProjectArchiveJobState.RESTORED;
            }
            default: {
                return undefined;
            }
        }
    }

    /** Gives up after too many failed attempts, see the class comment. */
    private async giveUp(archive: ProjectArchiveEntity): Promise<void> {
        const error = archive.error ?? 'Too many attempts';
        logger.error(`Giving up on archive ${archive.uuid}: ${error}`);

        if (REVERSIBLE_STATES.has(archive.state)) {
            // A reused archive (archived before, restored since) is still a
            // complete, valid copy: keep it for the next attempt
            const reused =
                archive.archivedAt !== null && archive.archivedAt !== undefined;
            if (!reused) await this.removeWrittenObjects(archive);
            await this.finish(
                archive,
                reused
                    ? ProjectArchiveJobState.RESTORED
                    : ProjectArchiveJobState.FAILED,
                ProjectArchiveState.ACTIVE,
                `Archiving failed, the files stayed in Kleinkram: ${error}`,
            );
            return;
        }

        // A restore that failed: the data is still safe in the archive
        await fs.rm(this.stagingDir(archive), { recursive: true, force: true });
        await this.finish(
            archive,
            ProjectArchiveJobState.ARCHIVED,
            ProjectArchiveState.ARCHIVED,
            `Restore failed: ${error}`,
        );
    }

    private async removeWrittenObjects(
        archive: ProjectArchiveEntity,
    ): Promise<void> {
        const keys = [
            ...archive.plan.flatMap((part) => [
                `${archive.location}/${part.name}`,
                `${archive.location}/${part.name}.partial`,
            ]),
            `${archive.location}/${MANIFEST_FILE}`,
            `${archive.location}/${MANIFEST_FILE}.partial`,
        ];
        for (const key of keys) {
            await this.storage.remove(key).catch((removeError: unknown) => {
                logger.warn(`Could not remove ${key}: ${String(removeError)}`);
            });
        }
    }

    /**
     * Plans the archive on the first run and writes every part that is not
     * written yet. A part interrupted half way is removed and written again.
     */
    private async pack(archive: ProjectArchiveEntity): Promise<void> {
        const context = await this.loadContext(archive);

        if (archive.plan.length === 0) {
            await this.plan(archive, context);
        }
        context.partNames = archive.plan.map((part) => part.name);

        let lastSave = Date.now();
        for (const [index, planned] of archive.plan.entries()) {
            if (archive.parts.some((part) => part.name === planned.name)) {
                continue;
            }
            const key = `${archive.location}/${planned.name}`;
            await this.storage.remove(`${key}.partial`);
            await this.storage.remove(key);

            const upload = await this.storage.upload(key);
            const partDigest = new Digest();
            const pack = tar.pack();
            const done = pipeline(
                Readable.from(pack),
                partDigest,
                upload.stream,
            );

            const entries: ArchivedFileEntry[] = [];
            try {
                for (const plannedFile of planned.files) {
                    const file = context.files.get(plannedFile.fileUuid);
                    if (!file?.mission) {
                        throw new Error(
                            `File ${plannedFile.fileUuid} disappeared while the project was archived`,
                        );
                    }
                    const digest = new Digest((bytes) => {
                        archive.bytesProcessed += bytes;
                    });
                    const source = await this.dataStorage.getFileStream(
                        file.uuid,
                    );
                    source.on('error', (error) => digest.destroy(error));
                    await writeEntry(
                        pack,
                        {
                            name: plannedFile.path,
                            size: plannedFile.size,
                            mtime: file.date,
                        },
                        source.pipe(digest),
                    );
                    if (digest.bytes !== plannedFile.size) {
                        throw new Error(
                            `${plannedFile.path}: read ${digest.bytes.toString()} of ${plannedFile.size.toString()} bytes`,
                        );
                    }
                    entries.push({
                        fileUuid: file.uuid,
                        missionUuid: file.mission.uuid,
                        filename: file.filename,
                        path: plannedFile.path,
                        size: plannedFile.size,
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
                            {
                                name: planned.name,
                                index,
                                count: archive.plan.length,
                            },
                            entries,
                        ),
                    ),
                );
                pack.finalize();
                await done;
            } catch (error) {
                pack.destroy();
                // The pipeline fails with the error we are about to rethrow
                await done.catch((pipelineError: unknown) => {
                    logger.debug(`Aborted part: ${String(pipelineError)}`);
                });
                await upload.abort();
                throw error;
            }
            await upload.commit();

            // Recorded only once the part is complete on the storage
            archive.parts.push({
                name: planned.name,
                size: partDigest.bytes,
                sha256: partDigest.sha256.digest('hex'),
                files: entries,
            });
            await this.archiveRepository.update(archive.uuid, {
                parts: archive.parts,
                bytesProcessed: archive.bytesProcessed,
            });
        }

        const manifestKey = `${archive.location}/${MANIFEST_FILE}`;
        await this.storage.remove(`${manifestKey}.partial`);
        await this.storage.remove(manifestKey);
        await this.storage.writeFile(
            manifestKey,
            manifestYaml(context, archive.parts),
        );
    }

    /** Decides the layout once; a resumed run writes the same parts. */
    private async plan(
        archive: ProjectArchiveEntity,
        context: ArchiveContext,
    ): Promise<void> {
        // Only what is actually in S3 can be archived
        const present: { file: FileEntity; size: number }[] = [];
        for (const file of context.files.values()) {
            const stat = await this.dataStorage.getFileInfo(file.uuid);
            if (stat) present.push({ file, size: stat.size });
            else logger.warn(`Archive ${archive.uuid}: ${file.uuid} not in S3`);
        }

        const usedPaths = new Set<string>([PART_METADATA_FILE]);
        const entryPath = (file: FileEntity): string => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- loaded with the file
            const mission = file.mission!;
            let candidate = `${safeName(mission.name)}/${safeName(file.filename)}`;
            if (usedPaths.has(candidate)) {
                candidate = `${safeName(mission.name)}-${mission.uuid}/${safeName(file.filename)}`;
            }
            usedPaths.add(candidate);
            return candidate;
        };

        archive.plan = planArchiveParts(present).map(
            (group, index): PlannedPart => ({
                name: partName(index),
                files: group.map(({ file, size }) => ({
                    fileUuid: file.uuid,
                    size,
                    path: entryPath(file),
                })),
            }),
        );
        archive.parts = [];
        archive.fileCount = present.length;
        archive.totalBytes = present.reduce((sum, item) => sum + item.size, 0);
        archive.bytesProcessed = 0;
        await this.archiveRepository.update(archive.uuid, {
            plan: archive.plan,
            parts: [],
            fileCount: archive.fileCount,
            totalBytes: archive.totalBytes,
            bytesProcessed: 0,
        });
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
            partNames: archive.plan.map((part) => part.name),
        };
    }

    /**
     * Re-reads every part and compares its checksum, and compares the
     * checksum of every archived file with the hash Kleinkram stored for it
     * at upload. Only then may S3 be purged.
     */
    private async verify(archive: ProjectArchiveEntity): Promise<void> {
        if (archive.parts.length !== archive.plan.length) {
            throw new Error('Not every planned part was written');
        }
        for (const part of archive.parts) {
            const sha256 = await sha256Of(
                this.storage.read(`${archive.location}/${part.name}`),
            );
            if (sha256 !== part.sha256) {
                throw new Error(`Checksum mismatch in ${part.name}`);
            }
        }

        const entries = archive.parts.flatMap((part) => part.files);
        const files = await this.fileRepository.find({
            where: { uuid: In(entries.map((entry) => entry.fileUuid)) },
            select: { uuid: true, hash: true },
        });
        const hashes = new Map(files.map((file) => [file.uuid, file.hash]));
        for (const entry of entries) {
            const known = hashes.get(entry.fileUuid);
            if (known && known !== entry.md5) {
                throw new Error(
                    `${entry.path}: archived MD5 ${entry.md5} differs from the stored hash ${known}`,
                );
            }
        }
    }

    /** Sealed: read-only for good, i.e. safe on the archive storage. */
    private async allSealed(archive: ProjectArchiveEntity): Promise<boolean> {
        const keys = archive.parts.map(
            (part) => `${archive.location}/${part.name}`,
        );
        // Archives written before the manifest moved to YAML have none
        const manifestKey = `${archive.location}/${MANIFEST_FILE}`;
        if (await this.storage.exists(manifestKey)) keys.push(manifestKey);
        const sealed = await Promise.all(
            keys.map((key) => this.storage.isSealed(key)),
        );
        logger.debug(
            `Archive ${archive.uuid}: ${sealed.filter(Boolean).length.toString()}/${keys.length.toString()} objects sealed`,
        );
        return sealed.every(Boolean);
    }

    /**
     * Removes the archived files from S3. Idempotent: deleting a missing
     * object succeeds, so a resumed purge simply runs again.
     */
    private async purge(archive: ProjectArchiveEntity): Promise<void> {
        // Last line of defence: the copy must still be there and sealed
        for (const part of archive.parts) {
            const key = `${archive.location}/${part.name}`;
            if (!(await this.storage.isSealed(key))) {
                throw new Error(`${part.name} is no longer sealed`);
            }
        }
        const entries = archive.parts.flatMap((part) => part.files);
        for (const entry of entries) {
            await this.dataStorage.deleteFile(entry.fileUuid);
        }
        logger.info(
            `Archive ${archive.uuid}: ${entries.length.toString()} files moved to the archive storage`,
        );
        archive.archivedAt = new Date();
        archive.bytesProcessed = archive.totalBytes;
    }

    private stagingDir(archive: ProjectArchiveEntity): string {
        return path.join(environment.ARCHIVE_STAGING_DIR, archive.uuid);
    }

    /**
     * Restores part by part: recall to the staging disk, verify, unpack into
     * S3, delete the staged copy. The staging disk thus only needs room for
     * one part, and a resumed restore starts at the first unfinished part.
     */
    private async restore(archive: ProjectArchiveEntity): Promise<void> {
        const staging = this.stagingDir(archive);
        const projectUuid = archive.project?.uuid ?? '';
        const doneBytes = (count: number): number =>
            archive.parts
                .slice(0, count)
                .reduce((sum, part) => sum + part.size, 0);

        for (
            let index = archive.partsDone;
            index < archive.parts.length;
            index++
        ) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- within bounds
            const part = archive.parts[index]!;
            const staged = path.join(staging, part.name);

            await this.setState(archive, ProjectArchiveJobState.RECALLING);
            await this.storage.recall(
                `${archive.location}/${part.name}`,
                staged,
                (bytes) => {
                    archive.bytesProcessed = doneBytes(index) + bytes;
                },
            );
            const sha256 = await sha256Of(createReadStream(staged));
            if (sha256 !== part.sha256) {
                throw new Error(`Checksum mismatch in recalled ${part.name}`);
            }

            await this.setState(archive, ProjectArchiveJobState.UNPACKING);
            await this.unpackPart(projectUuid, part.files, staged);
            await fs.rm(staged, { force: true });

            archive.partsDone = index + 1;
            archive.bytesProcessed = doneBytes(index + 1);
            await this.archiveRepository.update(archive.uuid, {
                partsDone: archive.partsDone,
                bytesProcessed: archive.bytesProcessed,
            });
        }
        await fs.rm(staging, { recursive: true, force: true });
        archive.restoredAt = new Date();
    }

    private async unpackPart(
        projectUuid: string,
        files: ArchivedFileEntry[],
        source: string,
    ): Promise<void> {
        const byPath = new Map(files.map((entry) => [entry.path, entry]));
        const restored = new Set<string>();
        const extract = tar.extract();

        const finished = new Promise<void>((resolve, reject) => {
            extract.on('entry', (header, stream, next) => {
                const entry = byPath.get(header.name);
                if (!entry) {
                    stream.resume();
                    stream.on('end', next);
                    return;
                }
                this.restoreEntry(projectUuid, entry, stream)
                    .then(() => {
                        restored.add(entry.path);
                        next();
                    })
                    .catch(reject);
            });
            extract.on('finish', resolve);
            extract.on('error', reject);
        });
        createReadStream(source).pipe(extract);
        await finished;

        const missing = files.filter((entry) => !restored.has(entry.path));
        if (missing.length > 0) {
            throw new Error(
                `${missing.length.toString()} file(s) missing in the tar, e.g. ${missing[0]?.path ?? ''}`,
            );
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

    /**
     * Moves the archive to its next state. Final states change the project
     * in the same transaction, so the two can never disagree.
     */
    private async setState(
        archive: ProjectArchiveEntity,
        state: ProjectArchiveJobState,
    ): Promise<void> {
        if (state === ProjectArchiveJobState.ARCHIVED) {
            await this.finish(archive, state, ProjectArchiveState.ARCHIVED);
            return;
        }
        if (state === ProjectArchiveJobState.RESTORED) {
            await this.finish(archive, state, ProjectArchiveState.ACTIVE);
            return;
        }
        archive.state = state;
        await this.archiveRepository.update(archive.uuid, {
            state,
            attempts: archive.attempts,
            error: archive.error ?? null,
            bytesProcessed: archive.bytesProcessed,
        });
    }

    private async finish(
        archive: ProjectArchiveEntity,
        state: ProjectArchiveJobState,
        projectState: ProjectArchiveState,
        error: string | null = null,
    ): Promise<void> {
        archive.state = state;
        await this.dataSource.transaction(async (manager) => {
            await manager.update(ProjectArchiveEntity, archive.uuid, {
                state,
                attempts: 0,
                error,
                bytesProcessed: archive.bytesProcessed,
                archivedAt: archive.archivedAt ?? null,
                restoredAt: archive.restoredAt ?? null,
            });
            if (archive.project) {
                await manager.update(ProjectEntity, archive.project.uuid, {
                    archiveState: projectState,
                });
            }
        });
    }
}
