import { computed, ComputedRef } from 'vue';
import { useRoute } from 'vue-router';

export const useProjectUUID = (): ComputedRef<undefined | string> => {
    const route = useRoute();
    return computed(() => {
        return (route.query.project_uuid ?? undefined) as string | undefined;
    });
};

export const useMissionUUID = (): ComputedRef<undefined | string> => {
    const route = useRoute();
    return computed(() => {
        return (route.query.mission_uuid ?? undefined) as string | undefined;
    });
};

export const useFileUUID = (): ComputedRef<undefined | string> => {
    const route = useRoute();
    return computed(() => {
        return (route.query.file_uuid ?? undefined) as string | undefined;
    });
};
