import { computed, ComputedRef } from 'vue';
import { useRoute } from 'vue-router';

export const useProjectUUID = (): ComputedRef<undefined | string> => {
    const route = useRoute();
    return computed(() => {
        return route.params.project_uuid !== null
            ? route.query.project_uuid
            : undefined;
    });
};

export const useMissionUUID = (): ComputedRef<undefined | string> => {
    const route = useRoute();
    return computed(() => {
        return route.params.mission_uuid !== null
            ? route.query.mission_uuid
            : undefined;
    });
};

export const useFileUUID = (): ComputedRef<undefined | string> => {
    const route = useRoute();
    return computed(() => {
        return route.params.file_uuid !== null
            ? route.query.file_uuid
            : undefined;
    });
};
