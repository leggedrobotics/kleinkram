import { ref, Ref, watch } from 'vue';
import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
import { Mission } from 'src/types/Mission';
import { getMission } from 'src/services/queries/mission';
import { Project } from 'src/types/Project';
import { filteredProjects, getProject } from 'src/services/queries/project';
import { useRouter } from 'vue-router';
import { QueryURLHandler } from 'src/services/QueryHandler';
import { getIsUploading } from 'src/services/queries/file';

export const useMissionQuery = (
    mission_uuid: Ref<string | undefined>,
    throwOnError: ((error: any, query: any) => boolean) | undefined = undefined,
    retryDelay: number = 1000,
): UseQueryReturnType<Mission | null, Error> => {
    return useQuery<Mission | null>({
        queryKey: ['mission', !!mission_uuid.value ? mission_uuid : ''],
        queryFn: () => {
            if (!mission_uuid.value) return null;
            return getMission(mission_uuid.value as string);
        },
        enabled: () => !!mission_uuid.value,
        retryDelay,
        throwOnError,
    });
};
export const useProjectQuery = (
    project_uuid: Ref<string | undefined>,
): UseQueryReturnType<Project | null, Error> =>
    useQuery<Project | null>({
        queryKey: ['project', project_uuid ? project_uuid : ''],
        queryFn: () => {
            if (!project_uuid.value) return null;
            return getProject(project_uuid.value as string).catch((e) => {
                console.error(e);
                return null;
            });
        },
        enabled: () => !!project_uuid.value,
    });

export const useAllProjectsQuery = (
    take: number,
    skip: number,
    sortBy: string,
    descending: boolean = false,
    searchParams?: {
        name: string;
    },
) => {
    return useQuery<Project[], Error>({
        queryKey: [
            'projects',
            { take, skip, sortBy, descending, searchParams },
        ],
        queryFn: () =>
            filteredProjects(take, skip, sortBy, descending, searchParams),
    });
};

export const useHandler = () => {
    const handler: Ref<QueryURLHandler> = ref(
        new QueryURLHandler(),
    ) as unknown as Ref<QueryURLHandler>;
    handler.value.setRouter(useRouter());

    return handler;
};

export const useIsUploading = (): Ref<boolean> | Ref<undefined> => {
    const { data: isUploading } = useQuery<boolean>({
        queryKey: ['isUploading'],
        queryFn: () => getIsUploading(),
        refetchInterval: 1000,
    });

    return isUploading;
};
