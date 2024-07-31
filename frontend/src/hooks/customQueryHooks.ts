import {ModelRef} from "vue";
import {useQuery, UseQueryReturnType} from "@tanstack/vue-query";
import {Mission} from "src/types/Mission";
import {getMission} from "src/services/queries/mission";
import {Project} from "src/types/Project";
import {getProject} from "src/services/queries/project";

export const useMissionQuery = (mission_uuid: ModelRef<string | undefined>): UseQueryReturnType<Mission | null, Error> => {
    return useQuery<Mission | null>({
        queryKey: ['mission', mission_uuid ? mission_uuid.value : ''],
        queryFn: () => mission_uuid.value ? getMission(mission_uuid.value as string) : null,
        enabled: () => !!mission_uuid.value
    });
}
export const useProjectQuery = (project_uuid: ModelRef<string | undefined>): UseQueryReturnType<Project | null, Error> => {
    return useQuery<Project | null>({
        queryKey: ['project', project_uuid ? project_uuid.value : ''],
        queryFn: () => project_uuid.value ? getProject(project_uuid.value as string) : null,
        enabled: () => !!project_uuid.value
    })
}

