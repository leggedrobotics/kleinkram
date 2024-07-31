import {ModelRef} from "vue";
import {useQuery, UseQueryReturnType} from "@tanstack/vue-query";
import {getProject} from "src/services/queries/project";
import {Project} from "src/types/Project";

export const useProjectQuery = (project_uuid: ModelRef<string | undefined>): UseQueryReturnType<Project | undefined, Error> => {
    return useQuery<Project | undefined>({
        queryKey: ['project', project_uuid],
        queryFn: () => project_uuid.value ? getProject(project_uuid.value as string) : undefined,
        enabled: () => !!project_uuid.value
    })
}
