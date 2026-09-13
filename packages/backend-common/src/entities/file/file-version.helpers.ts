import { EntityManager } from 'typeorm';
import { FileVersionEntity } from './file-version.entity';
import { FileEntity } from './file.entity';

/**
 * Persists the version-owned fields of `file` - state, size, hash, recording
 * window and so on - without writing the file row itself.
 *
 * Ingestion jobs hold on to a `FileEntity` for as long as it takes to read the
 * object out of storage. Saving that entity writes back every column it was
 * loaded with, `activeVersionUuid` included, which would silently undo a
 * version uploaded while the job was running. Writing only the version the job
 * actually worked on keeps the two independent.
 */
export const saveActiveVersion = async (
    manager: EntityManager,
    file: FileEntity,
): Promise<void> => {
    const version = file.activeVersion;
    if (!version) {
        throw new Error(
            `File ${file.uuid} has no active version to save the result to`,
        );
    }

    await manager.save(FileVersionEntity, version);
};
