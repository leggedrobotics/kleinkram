import {ModelRef} from "vue";
import {useQuery, UseQueryReturnType} from "@tanstack/vue-query";
import {Mission} from "src/types/Mission";
import {getMission} from "src/services/queries/mission";

export const useMissionQuery = (mission_uuid: ModelRef<string | undefined>): UseQueryReturnType<Mission | null, Error> => {
    return useQuery<Mission | null>({
        queryKey: ['mission', mission_uuid ? mission_uuid.value : ''],
        queryFn: () => mission_uuid.value ? getMission(mission_uuid.value as string) : null,
        enabled: () => !!mission_uuid.value
    });
}
