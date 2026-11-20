import type { SystemSettingsDto } from '@kleinkram/api-dto/types/system-settings.dto';
import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { useMission } from 'src/hooks/query-hooks';
import { getSystemSettings } from 'src/services/queries/system';
import { computed, type ComputedRef, type Ref } from 'vue';

export const SYSTEM_SETTINGS_QUERY_KEY = ['system-settings'];

export const useSystemSettings = (): UseQueryReturnType<
    SystemSettingsDto,
    Error
> =>
    useQuery({
        queryKey: SYSTEM_SETTINGS_QUERY_KEY,
        queryFn: getSystemSettings,
        staleTime: 60_000,
    });

/**
 * Whether the mission Preview tab is available: an admin can turn it off for
 * the whole instance, and a project's editors for their project.
 *
 * `isEnabled` stays false until both answers are in, so the tab never shows up
 * and disappears again; `isDisabled` is only true once one of them said no.
 */
export function useFoxglovePreviewEnabled(
    missionUuid: Ref<string | undefined>,
): { isEnabled: ComputedRef<boolean>; isDisabled: ComputedRef<boolean> } {
    const { data: settings } = useSystemSettings();
    // The project switch comes with the mission: users with access to a single
    // mission may not read its project.
    const { data: mission } = useMission(missionUuid);
    const project = computed(() => mission.value?.project);
    return {
        isEnabled: computed(
            () =>
                settings.value?.foxglovePreviewEnabled === true &&
                project.value?.foxglovePreviewEnabled === true,
        ),
        isDisabled: computed(
            () =>
                settings.value?.foxglovePreviewEnabled === false ||
                project.value?.foxglovePreviewEnabled === false,
        ),
    };
}
