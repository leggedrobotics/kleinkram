import { useHandler } from 'src/hooks/query-hooks';
import { computed, nextTick, ref, watch } from 'vue';

export function useFilterSync(
    handler: ReturnType<typeof useHandler>,
    refreshCallback: () => void,
) {
    const draftProjectUuid = ref<string | undefined>(handler.value.projectUuid);
    const draftMissionUuid = ref<string | undefined>(handler.value.missionUuid);

    // Sync draft from handler initially (and if URL changes externally)
    watch(
        () => handler.value.projectUuid,
        (value) => {
            if (value !== draftProjectUuid.value)
                draftProjectUuid.value = value;
        },
    );
    watch(
        () => handler.value.missionUuid,
        (value) => {
            if (value !== draftMissionUuid.value)
                draftMissionUuid.value = value;
        },
    );

    const projectUuid = computed(
        () => draftProjectUuid.value ?? handler.value.projectUuid,
    );
    const missionUuid = computed(
        () => draftMissionUuid.value ?? handler.value.missionUuid,
    );

    function setProjectUUID(v: string | undefined) {
        draftProjectUuid.value = v;
    }
    function setMissionUUID(v: string | undefined) {
        draftMissionUuid.value = v;
    }

    // Watch for changes from Advanced Filter UI to trigger URL update
    // Using nextTick to ensure all reactive updates (filterString) have propagated first
    watch([draftProjectUuid, draftMissionUuid], ([newProject, newMission]) => {
        // Only trigger refresh if the change wasn't from URL sync (handler watch)
        const projectChangedFromUI = newProject !== handler.value.projectUuid;
        const missionChangedFromUI = newMission !== handler.value.missionUuid;

        if (projectChangedFromUI || missionChangedFromUI) {
            void nextTick(() => {
                refreshCallback();
            });
        }
    });

    return {
        draftProjectUuid,
        draftMissionUuid,
        projectUuid,
        missionUuid,
        setProjectUUID,
        setMissionUUID,
    };
}
