import {Ref} from "vue";
import {useQuery, UseQueryReturnType} from "@tanstack/vue-query";
import {Mission} from "src/types/Mission";
import {getMission} from "src/services/queries/mission";
import {Project} from "src/types/Project";
import {getProject} from "src/services/queries/project";

export const useMissionQuery = (mission_uuid: Ref<string | undefined>): UseQueryReturnType<Mission | null, Error> => {
    return useQuery<Mission | null>({
        queryKey: ['mission', !!mission_uuid.value ? mission_uuid : ''],
        queryFn: () => {
            if (!mission_uuid.value) return null;
            return getMission(mission_uuid.value as string).catch(e => {
                console.error(e)
                return null
            });
        },
        enabled: () => !!mission_uuid.value
    });
}
export const useProjectQuery = (project_uuid: Ref<string | undefined>): UseQueryReturnType<Project | null, Error> =>
    useQuery<Project | null>({
        queryKey: ['project', project_uuid ? project_uuid : ''],
        queryFn: () => {
            if (!project_uuid.value) return null;
            return getProject(project_uuid.value as string).catch(e => {
                console.error(e)
                return null
            });
        },
        enabled: () => !!project_uuid.value
    });


