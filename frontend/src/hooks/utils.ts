import { ref, Ref, watch, WatchOptions } from 'vue';

/**
 * This function returns a set of boolean refs that represent the current display type.
 * The display type is determined by the project_uuid and mission_uuid refs, where:
 * - isListingProjects is true if project_uuid is undefined and mission_uuid is undefined
 * - isListingMissions is true if project_uuid is defined and mission_uuid is undefined
 * - isListingFiles is true if mission_uuid is defined
 *
 * @param project_uuid the uuid of the project
 * @param mission_uuid the uuid of the mission
 *
 * @returns a set of boolean refs that represent the current display type
 *
 */
export const useDisplayType = (
    project_uuid: Ref<string | undefined>,
    mission_uuid: Ref<string | undefined>,
) => {
    const isListingProjects = ref<boolean | undefined>(
        project_uuid.value === undefined && mission_uuid.value === undefined,
    );
    const isListingMissions = ref<boolean | undefined>(
        !!project_uuid.value && mission_uuid.value === undefined,
    );
    const isListingFiles = ref<boolean | undefined>(!!mission_uuid.value);

    watch([mission_uuid, project_uuid], () => {
        if (project_uuid.value && !mission_uuid.value) {
            isListingProjects.value = false;
            isListingMissions.value = true;
            isListingFiles.value = false;
        } else if (mission_uuid.value) {
            isListingProjects.value = false;
            isListingMissions.value = false;
            isListingFiles.value = true;
        } else {
            isListingProjects.value = true;
            isListingMissions.value = false;
            isListingFiles.value = false;
        }
    });

    return { isListingProjects, isListingMissions, isListingFiles };
};
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

/**
 * This functions works as a conditional watch, it will only call the callback if the ref has changed to true.
 *
 * @param ref the ref to watch
 * @param cb the callback to call
 * @param options watch options
 *
 */
export const conditionalWatch = (
    ref: Ref<boolean | undefined>,
    cb: () => void,
    options?: WatchOptions | undefined,
) => {
    watch(
        ref,
        () => {
            !!ref.value && cb();
        },
        options,
    );
};
