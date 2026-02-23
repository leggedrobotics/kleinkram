import type { MissionsDto } from '@kleinkram/api-dto';
import type { AccessGroupDto } from '@kleinkram/api-dto/types/access-control/access-group.dto';
import type { AccessGroupsDto } from '@kleinkram/api-dto/types/access-control/access-groups.dto';
import type { DefaultRightDto } from '@kleinkram/api-dto/types/access-control/default-right.dto';
import type { DefaultRights } from '@kleinkram/api-dto/types/access-control/default-rights';
import type { ProjectAccessListDto } from '@kleinkram/api-dto/types/access-control/project-access.dto';
import type { ActionWorkersDto } from '@kleinkram/api-dto/types/action-workers.dto';
import type { CategoriesDto } from '@kleinkram/api-dto/types/category.dto';
import type { FileEventsDto } from '@kleinkram/api-dto/types/file/file-event.dto';
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import type {
    PermissionsDto,
    ProjectPermissions,
} from '@kleinkram/api-dto/types/permissions.dto';
import type { ProjectWithRequiredTagsDto } from '@kleinkram/api-dto/types/project/project-with-required-tags.dto';
import type { ProjectsDto } from '@kleinkram/api-dto/types/project/projects.dto';
import type { StorageOverviewDto } from '@kleinkram/api-dto/types/storage-overview.dto';
import type {
    TagsDto,
    TagTypeDto,
} from '@kleinkram/api-dto/types/tags/tags.dto';
import type { ApiKeysDto } from '@kleinkram/api-dto/types/user/api-keys.dto';
import type { CurrentAPIUserDto } from '@kleinkram/api-dto/types/user/current-api-user.dto';
import type { UsersDto } from '@kleinkram/api-dto/types/user/users.dto';
import {
    AccessGroupRights,
    AccessGroupType,
    DataType,
    UserRole,
} from '@kleinkram/shared';
import {
    ThrowOnError,
    useQuery,
    UseQueryReturnType,
} from '@tanstack/vue-query';
import { AxiosError } from 'axios';
import { useQuasar } from 'quasar';
import ROUTES from 'src/router/routes';
import { getUser } from 'src/services/auth';
import {
    getAccessGroup,
    getProjectAccess,
    searchAccessGroups,
} from 'src/services/queries/access';
import { getCategories } from 'src/services/queries/categories';
import {
    fetchFile,
    getFileEvents,
    getIsUploading,
    getStorage,
} from 'src/services/queries/file';
import {
    getMission,
    getMissions,
    missionsOfProjectMinimal,
} from 'src/services/queries/mission';
import {
    filteredProjects,
    getProject,
    getProjectDefaultAccess,
} from 'src/services/queries/project';
import { getFilteredTagTypes, getTagTypes } from 'src/services/queries/tag';
import {
    getMyApiKeys,
    getPermissions,
    searchUsers,
} from 'src/services/queries/user';
import { allWorkers } from 'src/services/queries/worker';
import { QueryURLHandler } from 'src/services/query-handler';
import { computed, ComputedRef, ref, Ref, unref, watch } from 'vue';
import { useRouter } from 'vue-router';

export const usePermissionsQuery = (): UseQueryReturnType<
    PermissionsDto | null,
    Error
> => {
    return useQuery<PermissionsDto | null>({
        queryKey: ['permissions'],
        queryFn: () => {
            return getPermissions();
        },
    });
};

/**
 * Fetches the user data
 */
export const useUser = (): UseQueryReturnType<
    CurrentAPIUserDto | null,
    Error
> => {
    return useQuery<CurrentAPIUserDto | null>({
        queryKey: ['user'],
        queryFn: () => getUser(),
    });
};

/**
 * Fetches API key metadata for the current user
 * @param take
 * @param skip
 * @param sortBy
 * @param descending
 */
export const useMyApiKeys = (
    take: Ref<number>,
    skip: Ref<number>,
    sortBy: Ref<string>,
    descending: Ref<boolean>,
): UseQueryReturnType<ApiKeysDto | null, Error> => {
    return useQuery<ApiKeysDto | null>({
        queryKey: ['apiKeys', { take, skip, sortBy, descending }],
        queryFn: () =>
            getMyApiKeys(
                take.value,
                skip.value,
                sortBy.value,
                descending.value,
            ),
    });
};

export const getPermissionForProject = (
    projectUuid: string | undefined,
    permissions: PermissionsDto | undefined,
): AccessGroupRights => {
    if (permissions === undefined) return 0;
    if (permissions.role === UserRole.ADMIN) return AccessGroupRights._ADMIN;
    const defaultPermission = permissions.defaultPermission;

    const project = permissions.projects.find(
        (p: ProjectPermissions) => p.uuid === projectUuid,
    );

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const projectPermission = (project?.access as number) ?? 0;
    return Math.max(defaultPermission, projectPermission);
};

export const getPermissionForMission = (
    missionUuid: string | undefined,
    permissions: PermissionsDto | undefined,
): AccessGroupRights => {
    if (permissions === undefined) return 0;
    if (permissions.role === UserRole.ADMIN) return AccessGroupRights._ADMIN;
    const defaultPermission = permissions.defaultPermission;

    const mission = permissions.missions.find(
        (m: { uuid: string; access: number }) => m.uuid === missionUuid,
    );

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const missionPermission = (mission?.access as number) ?? 0;
    return Math.max(defaultPermission, missionPermission);
};

export const canCreateProject = (
    permissions: PermissionsDto | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (permissions.role === UserRole.ADMIN) return true;

    return permissions.defaultPermission >= AccessGroupRights.CREATE;
};

export const canCreateMission = (
    projectUuid: string | undefined,
    permissions: PermissionsDto | null | undefined,
): boolean => {
    if (!permissions) return false;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (projectUuid === null) return false;
    const permission = getPermissionForProject(projectUuid, permissions);
    return permission >= AccessGroupRights.CREATE;
};
export const canModifyProject = (
    projectUuid: string | undefined,
    permissions: PermissionsDto | null | undefined,
): boolean => {
    if (!permissions) return false;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (projectUuid === null) return false;
    const permission = getPermissionForProject(projectUuid, permissions);
    return permission >= AccessGroupRights.WRITE;
};

export const canModifyMission = (
    missionUuid: string | undefined,
    projectUuid: string | undefined,
    permissions: PermissionsDto | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (!missionUuid && !projectUuid) return false;

    const projectPermission = getPermissionForProject(projectUuid, permissions);
    if (projectPermission >= AccessGroupRights.WRITE) return true;

    const missionPermission = getPermissionForMission(missionUuid, permissions);
    if (missionPermission >= AccessGroupRights.WRITE) return true;

    return false;
};

export const canDeleteMission = (
    missionUuid: string | undefined,
    projectUuid: string | undefined,
    permissions: PermissionsDto | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (!missionUuid && !projectUuid) return false;

    const projectPermission = getPermissionForProject(projectUuid, permissions);
    if (projectPermission >= AccessGroupRights.DELETE) return true;

    const missionPermission = getPermissionForMission(missionUuid, permissions);
    return missionPermission >= AccessGroupRights.DELETE;
};

export const canLaunchInMission = (
    missionUuid?: string,
    projectUuid?: string,
    permissions?: PermissionsDto | null,
): boolean => {
    if (!permissions) return false;
    if (missionUuid === undefined) return false;
    if (projectUuid === undefined) return false;

    const projectPermission = getPermissionForProject(projectUuid, permissions);
    if (projectPermission >= AccessGroupRights.WRITE) return true;

    const missionPermission = getPermissionForMission(missionUuid, permissions);
    return missionPermission >= AccessGroupRights.WRITE;
};

export const canDeleteProject = (
    projectUuid: string | undefined,
    permissions: PermissionsDto | null | undefined,
): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (projectUuid === null) return false;
    if (!permissions) return false;
    const permission = getPermissionForProject(projectUuid, permissions);
    return permission >= AccessGroupRights.DELETE;
};

export const useProjectQuery = (
    projectUuid: Ref<string | undefined> | string | undefined,
): UseQueryReturnType<ProjectWithRequiredTagsDto, Error> =>
    useQuery<ProjectWithRequiredTagsDto>({
        queryKey: ['project', projectUuid],
        queryFn: (): Promise<ProjectWithRequiredTagsDto> => {
            return getProject(unref(projectUuid) ?? '');
        },
        enabled: () => unref(projectUuid) !== undefined,
    });

/**
 * Fetches the mission for a given mission UUID
 * @param missionUuid
 * @param throwOnError
 * @param retryDelay
 */
export const useMission = (
    missionUuid: Ref<string | undefined> | string,
    throwOnError?: ThrowOnError<
        MissionWithFilesDto,
        Error,
        MissionWithFilesDto,
        readonly unknown[]
    >,
    retryDelay = 1000,
): UseQueryReturnType<MissionWithFilesDto | undefined, Error> => {
    if (typeof missionUuid === 'string') {
        missionUuid = ref(missionUuid);
    }

    // @ts-ignore
    return useQuery<MissionWithFilesDto>({
        queryKey: ['mission', missionUuid],
        queryFn: () => getMission(missionUuid.value ?? ''),
        enabled: computed(
            () => missionUuid.value !== undefined && missionUuid.value !== '',
        ),
        retryDelay,
        throwOnError,
    });
};

export const useManyMissions = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    missionUuid: ComputedRef<(string | any[])[]>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allMissionUUIDs: ComputedRef<any[]>,
    hasMissionUUIDs: ComputedRef<boolean>,
): UseQueryReturnType<MissionsDto | undefined, Error> => {
    return useQuery<MissionsDto>({
        queryKey: missionUuid,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        queryFn: () => getMissions(allMissionUUIDs.value),
        enabled: hasMissionUUIDs,
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
    isLoadingError: Ref<false | true>,
    uuid: ComputedRef<undefined | string> | string,
    resourceName: 'project' | 'mission' | 'file',
    error: Ref<Error, Error> | Ref<null, null>,
): void => {
    const $router = useRouter();
    const $q = useQuasar();

    watch([isLoadingError], async () => {
        if (error.value instanceof AxiosError) {
            const statusCode =
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                Boolean(error.value.response?.data?.statusCode) ||
                `Could not load the ${resourceName}`;

            if (statusCode === '403')
                await $router.push({
                    name: ROUTES.ERROR_403.routeName,
                    query: {
                        message: `You are not authorized to access this ${resourceName}!`,
                        uuid: unref(uuid),
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

export const useHandler = (): Ref<QueryURLHandler, QueryURLHandler> => {
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

/**
 * Fetches the default rights for creating a new project. The default rights
 * of a new project consists of the following rights:
 *
 * - DELETE access for the creator
 * - inherited rights from the affiliation group
 *
 */
export const useProjectDefaultAccess = (): UseQueryReturnType<
    DefaultRights | undefined,
    Error
> => {
    return useQuery<DefaultRights>({
        queryKey: ['defaultRights'],
        queryFn: getProjectDefaultAccess,
    });
};

/**
 * Fetches the minimal access rights for a new project. The minimal access rights
 * for a new project consists of the following rights:
 *
 * - DELETE access for the creator
 *
 */
export const useMinimalAccessRightsForNewProject = (): ComputedRef<
    DefaultRightDto[]
> => {
    const { data: defaultRights } = useProjectDefaultAccess();
    return computed<DefaultRightDto[]>(
        () =>
            unref(defaultRights)?.data.filter(
                (r: DefaultRightDto) => r.type === AccessGroupType.PRIMARY,
            ) ?? [],
    );
};

export const useProjectAccessRights: (
    projectAccessUuid: string,
) => UseQueryReturnType<ProjectAccessListDto | undefined, Error> = (
    projectAccessUuid,
) => {
    return useQuery<ProjectAccessListDto>({
        queryKey: ['projectAccess', projectAccessUuid],
        queryFn: () => getProjectAccess(projectAccessUuid),
    });
};

export const useStorageOverview = (): UseQueryReturnType<
    StorageOverviewDto | undefined,
    Error
> => {
    return useQuery<StorageOverviewDto>({
        queryFn: () => getStorage(),
        queryKey: ['storage'],
    });
};

export const useFilteredProjects = (
    take: number | ComputedRef<number> | Ref<number>,
    skip: number | ComputedRef<number> | Ref<number>,
    sortBy: string | ComputedRef<string> | Ref<string>,
    descending: boolean | ComputedRef<boolean> | Ref<boolean>,
    searchParameter?:
        | Record<string, string>
        | ComputedRef<Record<string, string>>
        | Ref<Record<string, string>>,
): UseQueryReturnType<ProjectsDto | undefined, Error> => {
    return useQuery<ProjectsDto>({
        queryKey: ['projects', take, skip, sortBy, descending, searchParameter],
        queryFn: () => {
            const _take = typeof take === 'number' ? take : take.value;

            const _skip = typeof skip === 'number' ? skip : skip.value;
            const _sortBy = typeof sortBy === 'string' ? sortBy : sortBy.value;

            const _descending =
                typeof descending === 'boolean' ? descending : descending.value;

            const _searchParameter: Record<string, string> =
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                (typeof searchParameter?.value === 'object'
                    ? searchParameter.value
                    : (searchParameter as Record<string, string>)) ?? {};

            return filteredProjects(
                _take,
                _skip,
                _sortBy,
                _descending,
                _searchParameter,
            );
        },
    });
};

export const useMissionsOfProjectMinimal = (
    projectUuid: string | Ref<string | undefined>,
    take: number,
    skip: number,
): UseQueryReturnType<MissionsDto | undefined, Error> => {
    return useQuery<MissionsDto>({
        queryKey: ['missions', projectUuid],
        queryFn: () =>
            missionsOfProjectMinimal(unref(projectUuid) ?? '', take, skip),
    });
};

export const useWorkers = (): UseQueryReturnType<
    ActionWorkersDto | undefined,
    Error
> => {
    return useQuery<ActionWorkersDto>({
        queryKey: ['worker'],
        queryFn: () => allWorkers(),
        refetchInterval: 10_000,
    });
};

export const useUserSearch = (
    search: Ref<string>,
): UseQueryReturnType<UsersDto | undefined, Error> => {
    return useQuery<UsersDto>({
        queryKey: ['userSearch', search],
        queryFn: () => {
            if (search.value === '')
                return {
                    users: [],
                    count: 0,
                };
            return searchUsers(search.value);
        },
    });
};

export const useAllTags = (): UseQueryReturnType<TagTypeDto[], Error> => {
    return useQuery<TagTypeDto[]>({
        queryKey: ['tagTypes'],
        queryFn: getTagTypes,
    });
};

export const useFileEvents = (
    fileUuid: Ref<string | undefined>,
): UseQueryReturnType<FileEventsDto | undefined, Error> =>
    useQuery<FileEventsDto>({
        queryKey: ['file-events', fileUuid],
        queryFn: () => getFileEvents(unref(fileUuid) ?? ''),
        enabled: () => !!fileUuid.value,
        refetchInterval: 5000,
    });

export const useFilteredTag = (
    tagSearch: string,
    selectedDataType: DataType | undefined,
): UseQueryReturnType<TagsDto | undefined, Error> => {
    return useQuery({
        queryKey: computed(() => ['tagTypes', tagSearch, selectedDataType]),
        queryFn: async () => {
            return getFilteredTagTypes(tagSearch, selectedDataType);
        },
    });
};

export const useCategories = (
    uuid: string,
    filter: Ref<string>,
): UseQueryReturnType<CategoriesDto | undefined, Error> => {
    return useQuery<CategoriesDto>({
        queryKey: computed(() => ['categories', uuid, filter]),
        queryFn: () => getCategories(uuid, filter.value),
    });
};

export const useFile = (
    uuid: Ref<string | undefined> | string,
): UseQueryReturnType<FileWithTopicDto | undefined, Error> => {
    return useQuery({
        queryKey: ['file', uuid],
        queryFn: async () => fetchFile(unref(uuid) ?? ''),
        enabled: computed(() => unref(uuid) !== undefined),
    });
};

export const useAccessGroup = (
    uuid: string,
): UseQueryReturnType<AccessGroupDto | undefined, Error> => {
    return useQuery({
        queryKey: ['AccessGroup', uuid],
        queryFn: async () => {
            return getAccessGroup(uuid);
        },
    });
};

export const useSearchAccessGroup = (
    search: Ref<string> | string,
    type?: AccessGroupType,
): UseQueryReturnType<AccessGroupsDto | undefined, Error> => {
    return useQuery({
        queryKey: ['searchAccessGroup', search],
        queryFn: () =>
            searchAccessGroups(
                typeof search === 'string' ? search : search.value,
                type,
                0,
                10,
            ),
    });
};
