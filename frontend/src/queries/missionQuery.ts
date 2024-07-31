import {ModelRef} from "vue";
import {useQuery, UseQueryReturnType} from "@tanstack/vue-query";
import {Mission} from "src/types/Mission";
import {getMission} from "src/services/queries/mission";

export const useMissionQuery = (mission_uuid: ModelRef<string | undefined>): UseQueryReturnType<Mission | undefined, Error> => {
    return useQuery<Mission | undefined>({
        queryKey: ['mission', mission_uuid],
        queryFn: () => mission_uuid.value ? getMission(mission_uuid.value as string) : undefined,
        enabled: () => !!mission_uuid.value
    });
}
