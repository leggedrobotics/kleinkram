import { FlatMissionDto } from '@api/types/mission/mission.dto';
import { ProjectWithRequiredTagsDto } from '@api/types/project/project-with-required-tags.dto';
import {
    useFilteredProjects,
    useHandler,
    useMissionsOfProjectMinimal,
} from 'src/hooks/query-hooks';
import { computed, ComputedRef, Ref } from 'vue';

/**
 * A composable for managing scope selection (projects and missions).
 * Synchronizes with the global handler state to ensure consistent
 * selection across the application (the state handler uses the URL).
 *
 * * @returns An object containing:
 * - `projects`: A computed reference to the list of available projects.
 * - `selectedProject`: A computed reference to the currently selected project.
 * - `missions`: A computed reference to the list of missions for the selected project.
 * - `selectedMission`: A computed reference to the currently selected mission.
 * - `setProject`: A function to set the selected project by its UUID.
 *
 */
export function useScopeSelection(): {
    // State
    projects: ComputedRef<ProjectWithRequiredTagsDto[]>;
    missions: ComputedRef<FlatMissionDto[]>;
    selectedProjectUuid: ComputedRef<string | undefined>;
    selectedMissionUuid: ComputedRef<string | undefined>;

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

    const { data: projectsData, isLoading: isProjectsLoading } =
        useFilteredProjects(500, 0, 'name', false);

    const projects = computed(() => projectsData.value?.data ?? []);

    const projectUuid = computed(() => handler.value.projectUuid);

    const { data: missionsData, isLoading: isMissionsLoading } =
        useMissionsOfProjectMinimal(
            computed(() => projectUuid.value ?? ''),
            500,
            0,
        );

    const missions = computed(() => missionsData.value?.data ?? []);

    const setProject = (uuid: string | undefined): void => {
        handler.value.setProjectUUID(uuid);
        if (handler.value.missionUuid) {
            handler.value.setMissionUUID(undefined);
        }
    };

    const setMission = (uuid: string | undefined): void => {
        handler.value.setMissionUUID(uuid);
    };

    return {
        // State
        projects,
        missions,
        selectedProjectUuid: projectUuid,
        selectedMissionUuid: computed(() => handler.value.missionUuid),

        // Loading States (Crucial for UX)
        isLoading: computed(
            () => isProjectsLoading.value || isMissionsLoading.value,
        ),
        isProjectsLoading,
        isMissionsLoading,

        // Actions
        setProject,
        setMission,
    };
}
