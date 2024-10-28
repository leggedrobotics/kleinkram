import { computed, ref, Ref, watch } from 'vue';
import { useRoute } from 'vue-router';

/**
 * This function returns a boolean ref that gets set to true if any of the set_refs
 * change and set to false on any of the resetsRefs change.
 *
 * @param setRefs changes on these refs will set the state to true
 * @param resetsRefs changes on these refs will set the state to false
 * @param initialState initial value of the state ref
 *
 */
export const useToggle = (
    setRefs: Ref<any>[],
    resetsRefs: Ref<any>[],
    initialState = false,
): Ref<boolean> => {
    const state = ref(initialState);

    watch(setRefs, () => {
        state.value = true;
    });
    watch(resetsRefs, () => {
        state.value = false;
    });

    return state;
};

export const useProjectUUID = () => {
    const route = useRoute();
    return computed(() => {
        return (
            (route.params.project_uuid as string) ||
            (route.query.project_uuid as string)
        );
    });
};

export const useMissionUUID = () => {
    const route = useRoute();
    return computed(() => {
        return (
            (route.params.mission_uuid as string) || route.query.mission_uuid
        );
    });
};

export const useFileUUID = () => {
    const route = useRoute();
    return computed(() => {
        return route.params.file_uuid as string;
    });
};
