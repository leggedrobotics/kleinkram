import { FlatMissionDto } from '@api/types/mission/mission.dto';
import { ProjectWithRequiredTagsDto } from '@api/types/project/project-with-required-tags.dto';
import {
    useFilteredProjects,
    useHandler,
    useMissionsOfProjectMinimal,
} from 'src/hooks/query-hooks';
import { computed, ComputedRef, Ref } from 'vue';

export function useScopeSelection(
    localProjectUuid?: Ref<string | undefined>,
    localMissionUuid?: Ref<string | undefined>,
    customProjects?: Ref<ProjectWithRequiredTagsDto[] | undefined>,
): {
    // Data
    projects: ComputedRef<ProjectWithRequiredTagsDto[]>;
    missions: ComputedRef<FlatMissionDto[]>;

    // Selection State
    selectedProjectUuid: ComputedRef<string | undefined>;
    selectedMissionUuid: ComputedRef<string | undefined>;
    selectedProject: ComputedRef<ProjectWithRequiredTagsDto | undefined>;
    selectedMission: ComputedRef<FlatMissionDto | undefined>;

    // Loading States
    isLoading: ComputedRef<boolean>;
    isProjectsLoading:
        | Ref<boolean, boolean>
        | Ref<false, false>
        | Ref<true, true>;
    isMissionsLoading:
        | Ref<boolean, boolean>
        | Ref<false, false>
        | Ref<true, true>;

    // Actions
    setProject: (uuid: string | undefined) => void;
    setMission: (uuid: string | undefined) => void;
} {
    const handler = useHandler();
    const isLocalMode = !!localProjectUuid;

    const { data: projectsData, isLoading: isProjectsLoading } =
        useFilteredProjects(500, 0, 'name', false);

    const projects = computed(() => {
        if (customProjects?.value) return customProjects.value;
        return projectsData.value?.data ?? [];
    });

    // If local ref exists, use it. Otherwise, read from Handler.
    const selectedProjectUuid = computed(() =>
        isLocalMode ? localProjectUuid.value : handler.value.projectUuid,
    );

    const selectedMissionUuid = computed(() =>
        isLocalMode ? localMissionUuid?.value : handler.value.missionUuid,
    );

    const selectedProject = computed(() => {
        return projects.value.find((p) => p.uuid === selectedProjectUuid.value);
    });

    const selectedMission = computed(() => {
        return missions.value.find((m) => m.uuid === selectedMissionUuid.value);
    });

    // Missions (Reactive to whichever Project is selected) ---
    const { data: missionsData, isLoading: isMissionsLoading } =
        useMissionsOfProjectMinimal(
            computed(() => selectedProjectUuid.value ?? ''),
            500,
            0,
        );

    const missions = computed(() => missionsData.value?.data ?? []);

    const setProject = (uuid: string | undefined | null): void => {
        const value = uuid ?? undefined;

        if (isLocalMode && localProjectUuid) {
            localProjectUuid.value = value;
            if (localMissionUuid) localMissionUuid.value = undefined;
        } else {
            handler.value.setProjectUUID(value);
            if (handler.value.missionUuid)
                handler.value.setMissionUUID(undefined);
        }
    };

    const setMission = (uuid: string | undefined | null): void => {
        const value = uuid ?? undefined;
        if (isLocalMode && localMissionUuid) {
            localMissionUuid.value = value;
        } else {
            handler.value.setMissionUUID(value);
        }
    };

    return {
        // Data
        projects,
        missions,

        // State (UUIDs)
        selectedProjectUuid,
        selectedMissionUuid,
        selectedProject,
        selectedMission,

        // Actions
        setProject,
        setMission,

        // Loading
        isLoading: computed(
            () => isProjectsLoading.value || isMissionsLoading.value,
        ),
        isProjectsLoading,
        isMissionsLoading,
    };
}
