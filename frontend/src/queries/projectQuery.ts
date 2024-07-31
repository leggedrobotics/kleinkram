import {ModelRef} from "vue";
import {useQuery, UseQueryReturnType} from "@tanstack/vue-query";
import {getProject} from "src/services/queries/project";
import {Project} from "src/types/Project";

export const useProjectQuery = (project_uuid: ModelRef<string | undefined>): UseQueryReturnType<Project | null, Error> => {
    return useQuery<Project | null>({
        queryKey: ['project', project_uuid ? project_uuid.value : ''],
        queryFn: () => project_uuid.value ? getProject(project_uuid.value as string) : null,
        enabled: () => !!project_uuid.value
    })
}
