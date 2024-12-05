import { computed, ComputedRef } from 'vue';
import { useRoute } from 'vue-router';

/**
 *
 * Extracts the project UUID from the route (the URL).
 *
 * @returns The project UUID, or `undefined` if it is not present.
 *
 */
export const useProjectUUID = (): ComputedRef<undefined | string> => {
    const route = useRoute();
    return computed(() => {
        return (route.params.project_uuid ?? undefined) as string | undefined;
    });
};
/**
 * Extracts the mission UUID from the route (the URL).
 *
 * @returns The mission UUID, or `undefined` if it is not present.
 *
 */
export const useMissionUUID = (): ComputedRef<undefined | string> => {
    const route = useRoute();
    return computed(() => {
        return (route.params.mission_uuid ?? undefined) as string | undefined;
    });
};
/**
 * Extracts the file UUID from the route (the URL).
 *
 * @returns The file UUID, or `undefined` if it is not present.
 *
 */
export const useFileUUID = (): ComputedRef<undefined | string> => {
    const route = useRoute();
    return computed(() => {
        return (route.params.file_uuid ?? undefined) as string | undefined;
    });
};
