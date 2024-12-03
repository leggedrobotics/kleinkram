import { computed, ComputedRef, ref, Ref, watch } from 'vue';
import {
    ThrowOnError,
    useQuery,
    UseQueryReturnType,
} from '@tanstack/vue-query';
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
import { useRouter } from 'vue-router';
import { QueryURLHandler } from 'src/services/QueryHandler';
import {
    fetchFile,
    filesOfMission,
    getIsUploading,
    getStorage,
} from 'src/services/queries/file';
import { AxiosError } from 'axios';
import ROUTES from 'src/router/routes';
import { useQuasar } from 'quasar';
import { getPermissions, searchUsers } from 'src/services/queries/user';
import { getUser } from 'src/services/auth';
import {
    AccessGroupDto,
    AccessGroupsDto,
    CurrentAPIUserDto,
    UsersDto,
} from '@api/types/User.dto';
import { DefaultRightsDto } from '@api/types/DefaultRights.dto';
import {
    AccessGroupRights,
    AccessGroupType,
    DataType,
    FileType,
    UserRole,
} from '@common/enum';
import { StorageOverviewDto } from '@api/types/StorageOverview.dto';
import { allWorkers } from '../services/queries/worker';
import { WorkersDto } from '@api/types/Workers.dto';
import { TagsDto } from '@api/types/TagsDto.dto';
import { getFilteredTagTypes, getTagTypes } from '../services/queries/tag';
import {
    FlatMissionDto,
    MissionDto,
    MissionsDto,
} from '@api/types/Mission.dto';
import { FileQueueEntriesDto } from '@api/types/FileQueueEntry.dto';
import { getQueueForFile } from '../services/queries/queue';
import {
    ProjectAccessDto,
    ProjectDto,
    ProjectsDto,
} from '@api/types/Project.dto';
import { PermissionsDto } from '@api/types/Permissions.dto';
import { ActionsDto } from '@api/types/Actions.dto';
import { getActions, getRunningActions } from '../services/queries/action';
import { CategoriesDto } from '@api/types/Category.dto';
import { getCategories } from '../services/queries/categories';
import { FileDto, FilesDto } from '@api/types/Files.dto';
import { getAccessGroup, searchAccessGroups } from '../services/queries/access';

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
    const defaultPermission = permissions.default_permission;

    const project = permissions.projects.find(
        (p: ProjectAccessDto) => p.uuid === projectUuid,
    );

    // @ts-ignore
    const projectPermission = project?.access && 0;
    return Math.max(defaultPermission, projectPermission);
};

export const getPermissionForMission = (
    missionUuid: string | undefined,
    permissions: PermissionsDto | null,
): AccessGroupRights => {
    if (permissions === null) return 0;
    if (permissions.role === UserRole.ADMIN) return AccessGroupRights._ADMIN;
    const defaultPermission = permissions.default_permission;

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

    return permissions.default_permission >= AccessGroupRights.CREATE;
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
): boolean | undefined => {
    if (!permissions) return false;
    if (!missionUuid && !projectUuid) return false;

    const projectPermission = getPermissionForProject(projectUuid, permissions);
    if (projectPermission >= AccessGroupRights.WRITE) return true;

    const missionPermission = getPermissionForMission(missionUuid, permissions);
    if (missionPermission >= AccessGroupRights.WRITE) return true;
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
    mission: FlatMissionDto | null,
    permissions: PermissionsDto | null | undefined,
): boolean => {
    if (!permissions) return false;
    if (!mission) return false;

    const projectPermission = getPermissionForProject(
        mission.project.uuid,
        permissions,
    );
    if (projectPermission >= AccessGroupRights.WRITE) return true;

    const missionPermission = getPermissionForMission(
        mission.uuid,
        permissions,
    );
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
    projectUuid: Ref<string | undefined> | string,
): UseQueryReturnType<ProjectDto, Error> =>
    useQuery<ProjectDto>({
        queryKey: ['project', projectUuid ? projectUuid : ''],
        queryFn: (): Promise<ProjectDto> => {
            // @ts-ignore
            if (!projectUuid.value)
                return Promise.reject(new Error('Project UUID is not defined'));
            // @ts-ignore
            return getProject(projectUuid.value);
        },
        // @ts-ignore
        enabled: () => !!projectUuid.value,
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
        | ThrowOnError<MissionDto, Error, MissionDto, readonly unknown[]>
        | undefined = undefined,
    retryDelay = 1000,
): UseQueryReturnType<MissionDto | undefined, Error> => {
    if (typeof missionUuid === 'string') {
        missionUuid = ref(missionUuid);
    }

    return useQuery<MissionDto>({
        queryKey: ['mission', missionUuid],
        queryFn: () => getMission(missionUuid.value ?? ''),
        enabled: missionUuid.value !== undefined && missionUuid.value !== '',
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
    uuid: ComputedRef<undefined | string>,
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
 * Fetches the default rights for creating a new project.
 *
 */
export const useProjectDefaultAccess = (): UseQueryReturnType<
    DefaultRightsDto | undefined,
    Error
> => {
    return useQuery<DefaultRightsDto>({
        queryKey: ['defaultRights'],
        queryFn: getProjectDefaultAccess,
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
    take: number,
    skip: number,
    sortBy: string,
    descending: boolean,
    searchParameter?: Record<string, string>,
): UseQueryReturnType<ProjectsDto | undefined, Error> => {
    return useQuery<ProjectsDto>({
        queryKey: ['projects'],
        queryFn: () =>
            filteredProjects(take, skip, sortBy, descending, searchParameter),
    });
};

export const useMissionsOfProjectMinimal = (
    projectUuid: string,
    take: number,
    skip: number,
): UseQueryReturnType<MissionsDto | undefined, Error> => {
    return useQuery<MissionsDto>({
        queryKey: computed(() => ['missions', projectUuid]),
        queryFn: () => missionsOfProjectMinimal(projectUuid, take, skip),
    });
};

export const useWorkers = (): UseQueryReturnType<
    WorkersDto | undefined,
    Error
> => {
    return useQuery<WorkersDto>({
        queryKey: ['worker'],
        queryFn: () => allWorkers(),
        refetchInterval: 10_000,
    });
};

export const useUserSearch = (
    search: Ref<string>,
): UseQueryReturnType<UsersDto | undefined, Error> => {
    return useQuery<UsersDto>({
        queryKey: ['userSearch', search.value],
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

export const useAllTags = (): UseQueryReturnType<
    TagsDto | undefined,
    Error
> => {
    return useQuery<TagsDto>({
        queryKey: ['tagTypes'],
        queryFn: getTagTypes,
    });
};

export const useActions = (
    projectUuid: string,
    missionUuid: string,
    take: number,
    skip: number,
    sortBy: string,
    descending: boolean,
    search: string,
    queryKey: string,
): UseQueryReturnType<ActionsDto | undefined, Error> => {
    return useQuery<ActionsDto>({
        queryKey: computed(() => [
            'action_mission',
            projectUuid,
            missionUuid,
            queryKey,
        ]),
        queryFn: () =>
            getActions(
                projectUuid,
                missionUuid,
                take,
                skip,
                sortBy,
                descending,
                search,
            ),
        staleTime: 0,
        refetchInterval: 4000,
    });
};

export const useQueueForFile = (
    filename: string | undefined,
    missionUUID: string | undefined,
): UseQueryReturnType<FileQueueEntriesDto | undefined, Error> =>
    useQuery<FileQueueEntriesDto>({
        queryKey: ['queue', filename],
        queryFn: () => getQueueForFile(filename ?? '', missionUUID ?? ''),
        enabled: () =>
            !(filename === undefined) && !(missionUUID === undefined),
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
    filter: string,
): UseQueryReturnType<CategoriesDto | undefined, Error> => {
    return useQuery<CategoriesDto>({
        queryKey: computed(() => ['categories', uuid, filter]),
        queryFn: () => getCategories(uuid, filter),
    });
};

export const useFile = (
    uuid: string | undefined,
): UseQueryReturnType<FileDto | undefined, Error> => {
    return useQuery({
        queryKey: ['file', uuid],
        queryFn: async () => {
            if (uuid === undefined) return;
            return fetchFile(uuid);
        },
        enabled: computed(() => uuid !== undefined),
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
    type: AccessGroupType | undefined,
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
