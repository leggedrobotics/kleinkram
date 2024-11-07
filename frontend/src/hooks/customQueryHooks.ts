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
import { getUser } from 'src/services/auth';
import { User } from 'src/types/User';

type Permissions = {
    role: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
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

/**
 * Fetches the user data
 */
export const useUser = () => {
    return useQuery<User | null>({
        queryKey: ['user'],
        queryFn: () => getUser(),
    });
};

export const getPermissionForProject = (
    projectUuid: string,
    permissions: Permissions,
): number => {
    if (!permissions) return 0;
    if (permissions.role === 'ADMIN') return 100;
    const defaultPermission = permissions.default_permission;

    const project = permissions.projects.find(
        (p: { uuid: string; access: number }) => p.uuid === projectUuid,
    );

    const projectPermission = project?.access || 0;
    return Math.max(defaultPermission, projectPermission);
};

export const getPermissionForMission = (
    missionUuid: string,
    permissions: Permissions,
): number => {
    if (!permissions) return 0;
    if (permissions.role === 'ADMIN') return 100;
    const defaultPermission = permissions.default_permission;

    const mission = permissions.missions.find(
        (m: { uuid: string; access: number }) => m.uuid === missionUuid,
    );

    const missionPermission = mission?.access || 0;
    return Math.max(defaultPermission, missionPermission);
};

export const canCreateProject = (
    permissions: Permissions | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (permissions.role === 'ADMIN') return true;
    return permissions.default_permission >= AccessGroupRights.CREATE;
};

export const canCreateMission = (
    projectUuid: string | undefined,
    permissions: Permissions | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (!projectUuid) return false;
    const permission = getPermissionForProject(projectUuid, permissions);
    return permission >= AccessGroupRights.CREATE;
};
export const canModifyProject = (
    projectUuid: string | undefined,
    permissions: Permissions | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (!projectUuid) return false;
    const permission = getPermissionForProject(projectUuid, permissions);
    return permission >= AccessGroupRights.WRITE;
};

export const canModifyMission = (
    missionUuid: string | undefined,
    projectUuid: string | undefined,
    permissions: Permissions | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (!missionUuid && !projectUuid) return false;
    const missionPermission = getPermissionForMission(missionUuid, permissions);
    const projectPermission = getPermissionForProject(projectUuid, permissions);
    return (
        Math.max(missionPermission, projectPermission) >=
        AccessGroupRights.WRITE
    );
};

export const canDeleteMission = (
    missionUuid: string | undefined,
    projectUuid: string | undefined,
    permissions: Permissions | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (!missionUuid && !projectUuid) return false;
    const missionPermission = getPermissionForMission(missionUuid, permissions);
    const projectPermission = getPermissionForProject(projectUuid, permissions);
    return (
        Math.max(missionPermission, projectPermission) >=
        AccessGroupRights.DELETE
    );
};

export const canLaunchInMission = (
    mission: Mission | null,
    permissions: Permissions | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (!mission) return false;
    const missionPermission = getPermissionForMission(
        mission.uuid,
        permissions,
    );
    const projectPermission = getPermissionForProject(
        mission.project?.uuid as string,
        permissions,
    );
    return (
        Math.max(missionPermission, projectPermission) >=
        AccessGroupRights.CREATE
    );
};

export const canDeleteProject = (
    projectUuid: string | undefined,
    permissions: Permissions | null | undefined,
): boolean => {
    if (!projectUuid) return false;
    if (!permissions) return false;
    const permission = getPermissionForProject(projectUuid, permissions);
    return permission >= AccessGroupRights.DELETE;
};

export const useMissionQuery = (
    missionUuid: Ref<string | undefined>,
    throwOnError: ((error: any, query: any) => boolean) | undefined = undefined,
    retryDelay: number = 1000,
): UseQueryReturnType<Mission | null, Error> => {
    return useQuery<Mission | null>({
        queryKey: ['mission', missionUuid.value ? missionUuid : ''],
        queryFn: () => {
            if (!missionUuid.value) return null;
            return getMission(missionUuid.value);
        },
        enabled: () => !!missionUuid.value,
        retryDelay,
        throwOnError,
    });
};
export const useProjectQuery = (
    projectUuid: Ref<string | undefined>,
): UseQueryReturnType<Project, Error> =>
    useQuery<Project>({
        queryKey: ['project', projectUuid ? projectUuid : ''],
        queryFn: (): Promise<Project> => {
            if (!projectUuid.value) return Promise.reject();
            return getProject(projectUuid.value);
        },
        enabled: () => !!projectUuid.value,
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
 * @param resourceName
 * @param error
 */
export const registerNoPermissionErrorHandler = (
    isLoadingError: Ref<false, false> | Ref<true, true>,
    uuid: Ref<string>,
    resourceName: 'project' | 'mission' | 'file',
    error: Ref<Error, Error> | Ref<null, null>,
) => {
    const $router = useRouter();
    const $q = useQuasar();

    watch([isLoadingError], async () => {
        if (error.value instanceof AxiosError) {
            const statusCode =
                error.value.response?.data?.statusCode ||
                `Could not load the ${resourceName}`;

            if (statusCode == 403)
                await $router.push({
                    name: ROUTES.ERROR_403.routeName,
                    query: {
                        message: `You are not authorized to access this ${resourceName}!`,
                        uuid: uuid.value,
                    },
                });
        } else {
            $q.notify({
                message: `Could not load the ${resourceName}, please try again!`,
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
