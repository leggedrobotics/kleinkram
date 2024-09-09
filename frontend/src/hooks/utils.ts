import { computed, ref, Ref, watch } from 'vue';
import { useRoute } from 'vue-router';

/**
 * This function returns a boolean ref that gets set to true if any of the set_refs
 * change and set to false on any of the resets_refs change.
 *
 * @param set_refs changes on these refs will set the state to true
 * @param resets_refs changes on these refs will set the state to false
 * @param initial_state initial value of the state ref
 *
 */
export const useToggle = (
    set_refs: Ref<any>[],
    resets_refs: Ref<any>[],
    initial_state = false,
): Ref<boolean> => {
    const state = ref(initial_state);

    watch(set_refs, () => {
        state.value = true;
    });
    watch(resets_refs, () => {
        state.value = false;
    });

    return state;
};

export const useProjectUUID = () => {
    const route = useRoute();
    return computed(() => {
        return route.params.project_uuid as string;
    });
};

export const useMissionUUID = () => {
    const route = useRoute();
    return computed(() => {
        return route.params.mission_uuid as string;
    });
};

export const useFileUUID = () => {
    const route = useRoute();
    return computed(() => {
        return route.params.file_uuid as string;
    });
};
