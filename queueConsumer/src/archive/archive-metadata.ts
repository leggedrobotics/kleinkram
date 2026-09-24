import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import {
    ArchivedFileEntry,
    ArchivePart,
    ProjectArchiveEntity,
} from '@kleinkram/backend-common/entities/project/project-archive.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import {
    loadArchiveConfig,
    renderRestoreInstructions,
} from '@kleinkram/backend-common/modules/archive-storage/archive-config';
import { stringify } from 'yaml';

/** Name of the metadata file stored as the last entry of every tar part. */
export const PART_METADATA_FILE = 'kleinkram.yml';

/** Name of the project-wide index written next to the tar parts. */
export const MANIFEST_FILE = 'manifest.yml';

const HEADER = `# Kleinkram project archive
#
# The files in this archive are stored byte for byte as they were uploaded
# (ROS bags, MCAPs, ...), one tar entry per file at <mission>/<filename>.
# A file is never split across tar parts. Extract with \`tar -xf\` and check
# them against the sha256/md5 below; no Kleinkram instance is needed.
`;

export interface ArchiveContext {
    archive: ProjectArchiveEntity;
    project: ProjectEntity;
    missions: MissionEntity[];
    files: Map<string, FileEntity>;
    /** Names of all tar parts of the archive, known once they are planned. */
    partNames: string[];
}

/**
 * What the storage is and how to get the files back without Kleinkram, as
 * configured for this deployment (ARCHIVE_CONFIG_PATH).
 */
const describeStorage = (context: ArchiveContext): Record<string, unknown> => {
    const config = loadArchiveConfig();
    return {
        name: config.name,
        description: config.description,
        links: config.links.length > 0 ? config.links : undefined,
        howToRestore: renderRestoreInstructions({
            projectName: context.project.name,
            projectUuid: context.project.uuid,
            archiveUuid: context.archive.uuid,
            location: context.archive.location,
            parts: context.partNames,
        }),
    };
};

const metadataValue = (
    metadata: MetadataEntity,
): string | number | boolean | Date | null =>
    metadata.value_string ??
    metadata.value_number ??
    metadata.value_boolean ??
    metadata.value_date ??
    metadata.value_location ??
    null;

const describeProject = (project: ProjectEntity): Record<string, unknown> => ({
    uuid: project.uuid,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
});

const describeMission = (mission: MissionEntity): Record<string, unknown> => ({
    uuid: mission.uuid,
    name: mission.name,
    createdAt: mission.createdAt,
    metadata: Object.fromEntries(
        (mission.metadata ?? []).map((metadata) => [
            metadata.metadataType?.name ?? 'unknown',
            metadataValue(metadata),
        ]),
    ),
});

const describeFile = (
    entry: ArchivedFileEntry,
    file: FileEntity | undefined,
): Record<string, unknown> => ({
    path: entry.path,
    uuid: entry.fileUuid,
    missionUuid: entry.missionUuid,
    filename: entry.filename,
    type: file?.type,
    size: entry.size,
    md5: entry.md5,
    sha256: entry.sha256,
    date: file?.date,
    recordingStartDate: file?.recordingStartDate ?? undefined,
    recordingEndDate: file?.recordingEndDate ?? undefined,
    uploadedAt: file?.createdAt,
    categories: (file?.categories ?? []).map((category) => category.name),
    topics: (file?.topics ?? []).map((topic) => ({
        name: topic.name,
        type: topic.type,
        messages:
            topic.nrMessages === undefined
                ? undefined
                : Number(topic.nrMessages),
        frequency: topic.frequency,
    })),
});

const toYaml = (document: Record<string, unknown>): string =>
    HEADER + '\n' + stringify(document, { aliasDuplicateObjects: false });

/**
 * Metadata of the files inside one tar part, so that every tar can be
 * understood on its own.
 */
export function partMetadataYaml(
    context: ArchiveContext,
    part: { name: string; index: number; count: number },
    entries: ArchivedFileEntry[],
): string {
    const missionUuids = new Set(entries.map((entry) => entry.missionUuid));
    return toYaml({
        format: 'kleinkram-archive-part/v1',
        archive: {
            uuid: context.archive.uuid,
            part: part.name,
            partNumber: part.index + 1,
            partCount: part.count,
            createdAt: new Date(),
        },
        storage: describeStorage(context),
        project: describeProject(context.project),
        missions: context.missions
            .filter((mission) => missionUuids.has(mission.uuid))
            .map((mission) => describeMission(mission)),
        files: entries.map((entry) =>
            describeFile(entry, context.files.get(entry.fileUuid)),
        ),
    });
}

/** Index of all parts, written next to them on the archive storage. */
export function manifestYaml(
    context: ArchiveContext,
    parts: ArchivePart[],
): string {
    return toYaml({
        format: 'kleinkram-project-archive/v1',
        archive: {
            uuid: context.archive.uuid,
            createdAt: new Date(),
            reason: context.archive.reason ?? undefined,
        },
        storage: describeStorage(context),
        project: describeProject(context.project),
        missions: context.missions.map((mission) => describeMission(mission)),
        parts: parts.map((part) => ({
            name: part.name,
            size: part.size,
            sha256: part.sha256,
            files: part.files.map((entry) =>
                describeFile(entry, context.files.get(entry.fileUuid)),
            ),
        })),
    });
}
