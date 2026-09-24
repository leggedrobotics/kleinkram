import type { ProjectArchiveStatusDto } from '@kleinkram/api-dto/types/project/project-archive.dto';
import { ProjectArchiveJobState, ProjectArchiveState } from '@kleinkram/shared';
import {
    useQuery,
    useQueryClient,
    UseQueryReturnType,
} from '@tanstack/vue-query';
import { useProjectQuery } from 'src/hooks/query-hooks';
import { getProjectArchiveStatus } from 'src/services/queries/project';
import { computed, ComputedRef, Ref, unref, watch } from 'vue';

const TRANSITIONAL_STATES = new Set([
    ProjectArchiveState.ARCHIVING,
    ProjectArchiveState.RESTORING,
]);

/**
 * Archive status of a project. Polls while an archive or restore runs and
 * refreshes the project once it finished, so that the read-only state of the
 * whole page follows.
 */
export const useProjectArchiveStatus = (
    projectUuid: Ref<string | undefined>,
): UseQueryReturnType<ProjectArchiveStatusDto, Error> => {
    const queryClient = useQueryClient();
    const query = useQuery<ProjectArchiveStatusDto>({
        queryKey: ['project-archive', projectUuid],
        queryFn: () => getProjectArchiveStatus(unref(projectUuid) ?? ''),
        enabled: () => unref(projectUuid) !== undefined,
        refetchInterval: (current) =>
            current.state.data &&
            TRANSITIONAL_STATES.has(current.state.data.archiveState)
                ? 2000
                : false,
    });

    watch(
        () => query.data.value?.archiveState,
        async (state, previous) => {
            if (previous === undefined || state === previous) return;
            await queryClient.invalidateQueries({
                predicate: (q) =>
                    q.queryKey[0] === 'projects' ||
                    (q.queryKey[0] === 'project' &&
                        q.queryKey[1] === unref(projectUuid)),
            });
        },
    );

    return query;
};

/**
 * Whether the data of the project is not in the object storage. Such a
 * project is read-only: its metadata can be browsed, but files cannot be
 * uploaded, downloaded or processed.
 */
export const useProjectArchived = (
    projectUuid: Ref<string | undefined>,
): ComputedRef<boolean> => {
    const { data: project } = useProjectQuery(projectUuid);
    return computed(
        () =>
            project.value?.archiveState !== undefined &&
            project.value.archiveState !== ProjectArchiveState.ACTIVE,
    );
};

export interface ArchiveStep {
    state: ProjectArchiveJobState;
    label: string;
    hint: string;
}

export const ARCHIVE_STEPS: ArchiveStep[] = [
    {
        state: ProjectArchiveJobState.PACKING,
        label: 'Packing',
        hint: 'Streaming the files into tar parts on the long term storage',
    },
    {
        state: ProjectArchiveJobState.VERIFYING,
        label: 'Verifying',
        hint: 'Re-reading every part and comparing checksums',
    },
    {
        state: ProjectArchiveJobState.AWAITING_TAPE,
        label: 'Writing to tape',
        hint: 'LTS seals the parts after its delay timer (1h) and copies them to tape at two sites',
    },
    {
        state: ProjectArchiveJobState.PURGING,
        label: 'Freeing storage',
        hint: 'Removing the files from the Kleinkram storage',
    },
];

export const RESTORE_STEPS: ArchiveStep[] = [
    {
        state: ProjectArchiveJobState.RECALLING,
        label: 'Recalling from tape',
        hint: 'Mounting the tapes and copying the parts to a staging disk, this can take hours',
    },
    {
        state: ProjectArchiveJobState.UNPACKING,
        label: 'Unpacking',
        hint: 'Checking every file and uploading it back to the Kleinkram storage',
    },
];
