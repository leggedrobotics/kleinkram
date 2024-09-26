import { ref, Ref, watch } from 'vue';
import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
import { Mission } from 'src/types/Mission';
import { getMission } from 'src/services/queries/mission';
import { Project } from 'src/types/Project';
import { filteredProjects, getProject } from 'src/services/queries/project';
import { useRouter } from 'vue-router';
import { QueryURLHandler } from 'src/services/QueryHandler';
import { getIsUploading } from 'src/services/queries/file';
import { AxiosError } from 'axios';
import ROUTES from 'src/router/routes';
import { useQuasar } from 'quasar';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import { getPermissions } from 'src/services/queries/user';

type Permissions = {
    role: string;
    default_permission: number;
    projects: {
        uuid: string;
        access: number;
    }[];
    missions: {
        uuid: string;
        access: number;
    }[];
};

export const usePermissionsQuery = (): UseQueryReturnType<
    Permissions | null,
    Error
> => {
    return useQuery<Permissions | null>({
        queryKey: ['permissions'],
        queryFn: () => {
            return getPermissions();
        },
    });
};

export const getPermissionForProject = (
    project_uuid: string,
    permissions: Permissions,
): number => {
    if (!permissions) return 0;
    if (permissions.role === 'ADMIN') return 100;
    const default_permission = permissions.default_permission;

    const project = permissions.projects.find(
        (p: { uuid: string; access: number }) => p.uuid === project_uuid,
    );

    const project_permission = project?.access || 0;
    return Math.max(default_permission, project_permission);
};

export const getPermissionForMission = (
    mission_uuid: string,
    permissions: Permissions,
): number => {
    if (!permissions) return 0;
    if (permissions.role === 'ADMIN') return 100;
    const default_permission = permissions.default_permission;

    const mission = permissions.missions.find(
        (m: { uuid: string; access: number }) => m.uuid === mission_uuid,
    );

    const mission_permission = mission?.access || 0;
    return Math.max(default_permission, mission_permission);
};

export const canCreateProject = (
    permissions: Permissions | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (permissions.role === 'ADMIN') return true;
    return permissions.default_permission >= AccessGroupRights.CREATE;
};

export const canCreateMission = (
    project_uuid: string | undefined,
    permissions: Permissions | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (!project_uuid) return false;
    const permission = getPermissionForProject(project_uuid, permissions);
    return permission >= AccessGroupRights.CREATE;
};
export const canModifyProject = (
    project_uuid: string | undefined,
    permissions: Permissions | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (!project_uuid) return false;
    const permission = getPermissionForProject(project_uuid, permissions);
    return permission >= AccessGroupRights.WRITE;
};

export const canModifyMission = (
    mission_uuid: string | undefined,
    project_uuid: string | undefined,
    permissions: Permissions | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (!mission_uuid && !project_uuid) return false;
    const mission_permission = getPermissionForMission(
        mission_uuid,
        permissions,
    );
    const project_permission = getPermissionForProject(
        project_uuid,
        permissions,
    );
    return (
        Math.max(mission_permission, project_permission) >=
        AccessGroupRights.WRITE
    );
};

export const canDeleteMission = (
    mission_uuid: string | undefined,
    project_uuid: string | undefined,
    permissions: Permissions | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (!mission_uuid && !project_uuid) return false;
    const mission_permission = getPermissionForMission(
        mission_uuid,
        permissions,
    );
    const project_permission = getPermissionForProject(
        project_uuid,
        permissions,
    );
    return (
        Math.max(mission_permission, project_permission) >=
        AccessGroupRights.DELETE
    );
};

export const canDeleteProject = (
    project_uuid: string | undefined,
    permissions: Permissions | null | undefined,
): boolean => {
    if (!project_uuid) return false;
    if (!permissions) return false;
    const permission = getPermissionForProject(project_uuid, permissions);
    return permission >= AccessGroupRights.DELETE;
};

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
): UseQueryReturnType<Project, Error> =>
    useQuery<Project>({
        queryKey: ['project', project_uuid ? project_uuid : ''],
        queryFn: (): Promise<Project> => {
            if (!project_uuid.value) return Promise.reject();
            return getProject(project_uuid.value as string);
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

/**
 * Register a handler for the case when the user does not have permission to access a resource
 *
 * Redirects the user to the 403 page if the error is a 403 error
 *
 * @param isLoadingError
 * @param uuid
 * @param resource_name
 * @param error
 */
export const registerNoPermissionErrorHandler = (
    isLoadingError: Ref<false, false> | Ref<true, true>,
    uuid: Ref<string>,
    resource_name: 'project' | 'mission' | 'file',
    error: Ref<Error, Error> | Ref<null, null>,
) => {
    const $router = useRouter();
    const $q = useQuasar();

    watch([isLoadingError], async () => {
        if (error.value instanceof AxiosError) {
            const status_code =
                error.value?.response?.data?.statusCode ||
                `Could not load the ${resource_name}`;

            if (status_code == 403)
                await $router.push({
                    name: ROUTES.ERROR_403.routeName,
                    query: {
                        message: `You are not authorized to access this ${resource_name}!`,
                        uuid: uuid.value,
                    },
                });
        } else {
            $q.notify({
                message: `Could not load the ${resource_name}, please try again!`,
                color: 'negative',
                position: 'top',
                timeout: 2000,
            });
        }
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
        refetchInterval: 5000,
    });

    return isUploading;
};
