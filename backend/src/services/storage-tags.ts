import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { FileState } from '@kleinkram/shared';
import logger from '../logger';

/**
 * File states whose data never reached (or no longer is in) the bucket, so
 * there is no object to tag.
 */
const STATES_WITHOUT_OBJECT = new Set<FileState>([
    FileState.UPLOADING,
    FileState.CANCELED,
    FileState.LOST,
]);

interface TaggableFile {
    uuid: string;
    state?: FileState;
}

/**
 * Updates the storage tags (project, mission, filename) of a file after its
 * change was saved in the database.
 *
 * The tags only mirror the database and are not needed to serve the file,
 * so this is best effort: a failure is logged and never fails the request,
 * whose change already happened. `POST /files/resetS3Tags` rewrites the tags
 * of all files if they ever drift.
 */
export const updateStorageTags = async (
    dataStorage: IStorageBucket,
    file: TaggableFile,
    tags: Record<string, string>,
): Promise<void> => {
    if (file.state !== undefined && STATES_WITHOUT_OBJECT.has(file.state)) {
        return;
    }
    try {
        await dataStorage.addTags(file.uuid, tags);
    } catch (error: unknown) {
        logger.warn(
            `Updating the storage tags of file ${file.uuid} failed, ` +
                `the database change was saved: ${String(error)}`,
        );
    }
};
