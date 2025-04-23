import { AccessGroupsDto } from '@api/types/access-control/access-groups.dto';
import { DefaultRightDto } from '@api/types/access-control/default-right.dto';
import { DefaultRights } from '@api/types/access-control/default-rights';
import { ProjectAccessListDto } from '@api/types/access-control/project-access.dto';
import { ActionWorkersDto } from '@api/types/action-workers.dto';
import { ActionsDto } from '@api/types/actions/action.dto';
import { CategoriesDto } from '@api/types/category.dto';
import { FileQueueEntriesDto } from '@api/types/file/file-queue-entry.dto';
import { FileDto, FileWithTopicDto } from '@api/types/file/file.dto';
import { FilesDto } from '@api/types/file/files.dto';
import {
    MissionsDto,
    MissionWithFilesDto,
} from '@api/types/mission/mission.dto';
import { PermissionsDto, ProjectPermissions } from '@api/types/permissions.dto';
import { ProjectWithRequiredTags } from '@api/types/project/project-with-required-tags';
import { ProjectsDto } from '@api/types/project/projects.dto';
import { StorageOverviewDto } from '@api/types/storage-overview.dto';
import { TagsDto, TagTypeDto } from '@api/types/tags/tags.dto';
import {
    AccessGroupDto,
    CurrentAPIUserDto,
    UsersDto,
} from '@api/types/user.dto';
import {
    AccessGroupRights,
    AccessGroupType,
    DataType,
    FileType,
    UserRole,
} from '@common/enum';
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
import { getActions, getRunningActions } from 'src/services/queries/action';
import { getCategories } from 'src/services/queries/categories';
import {
    fetchFile,
    filesOfMission,
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
import { getQueueForFile } from 'src/services/queries/queue';
import { getFilteredTagTypes, getTagTypes } from 'src/services/queries/tag';
import { getPermissions, searchUsers } from 'src/services/queries/user';
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
    if (projectUuid === null) return false;
    const permission = getPermissionForProject(projectUuid, permissions);
    return permission >= AccessGroupRights.CREATE;
};
export const canModifyProject = (
    projectUuid: string | undefined,
    permissions: PermissionsDto | null | undefined,
): boolean => {
    if (!permissions) return false;
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
    if (projectUuid === null) return false;
    if (!permissions) return false;
    const permission = getPermissionForProject(projectUuid, permissions);
    return permission >= AccessGroupRights.DELETE;
};

export const useProjectQuery = (
    projectUuid: Ref<string | undefined> | string | undefined,
): UseQueryReturnType<ProjectWithRequiredTags, Error> =>
    useQuery<ProjectWithRequiredTags>({
        queryKey: ['project', projectUuid],
        queryFn: (): Promise<ProjectWithRequiredTags> => {
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
    throwOnError:
        | ThrowOnError<
              MissionWithFilesDto,
              Error,
              MissionWithFilesDto,
              readonly unknown[]
          >
        | undefined = undefined,
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
    missionUuid: ComputedRef<(string | any[])[]>,
    allMissionUUIDs: ComputedRef<any[]>,
    hasMissionUUIDs: ComputedRef<boolean>,
): UseQueryReturnType<MissionsDto | undefined, Error> => {
    return useQuery<MissionsDto>({
        queryKey: missionUuid,
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

export const useActions = (
    projectUuid: Ref<string> | string,
    missionUuid: Ref<string | undefined> | string | undefined = undefined,
    take: Ref<number>,
    skip: Ref<number>,
    sortBy: Ref<string>,
    descending: Ref<boolean>,
    search: Ref<string> | undefined = undefined,
    queryKey: string,
): UseQueryReturnType<ActionsDto | undefined, Error> => {
    if (missionUuid === undefined) missionUuid = '';
    if (search === undefined) search = computed(() => '');

    return useQuery<ActionsDto>({
        queryKey: computed(() => [
            'action_mission',
            projectUuid,
            missionUuid,
            queryKey,
            take,
            skip,
            sortBy,
            descending,
            search,
        ]),
        queryFn: () =>
            getActions(
                unref(projectUuid),
                unref(missionUuid) ?? '',
                unref(take),
                unref(skip),
                unref(sortBy),
                unref(descending),
                unref(search) ?? '',
            ),
        staleTime: 0,
        refetchInterval: 4000,
    });
};

export const useQueueForFile = (
    file: Ref<FileDto> | undefined,
): UseQueryReturnType<FileQueueEntriesDto | undefined, Error> =>
    useQuery<FileQueueEntriesDto>({
        queryKey: ['queue', file],
        queryFn: () =>
            getQueueForFile(
                file?.value.filename ?? '',
                file?.value.mission.uuid ?? '',
            ),
        enabled: () =>
            !(file?.value.filename === undefined) &&
            !(file.value.mission.uuid === undefined),
        refetchInterval: 1000,
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

export const useMcapFilesOfMission = (
    uuid: string | undefined,
    mcapName: string,
): UseQueryReturnType<FilesDto | undefined, Error> =>
    useQuery({
        queryKey: computed(() => ['files', uuid, mcapName]),
        queryFn: () =>
            filesOfMission(uuid ?? '', 100, 0, FileType.MCAP, mcapName),
        enabled() {
            return uuid !== undefined;
        },
    });

export const useRunningActions = (): UseQueryReturnType<
    ActionsDto | undefined,
    Error
> =>
    useQuery({
        queryKey: ['actions'],
        queryFn: () => getRunningActions(),
        staleTime: 100,
        refetchInterval: 5000,
    });

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
