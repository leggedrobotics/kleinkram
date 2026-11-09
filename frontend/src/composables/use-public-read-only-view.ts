import {
    canCreateMission,
    usePermissionsQuery,
    useProjectQuery,
} from 'src/hooks/query-hooks';
import { computed, ComputedRef, Ref } from 'vue';

/**
 * Whether the current user can only read a public project, typically because
 * they have access through public access alone. Such users get a read-only
 * page: controls they cannot use are hidden instead of shown disabled.
 */
export const usePublicReadOnlyView = (
    projectUuid: Ref<string | undefined>,
): ComputedRef<boolean> => {
    const { data: project } = useProjectQuery(projectUuid);
    const { data: permissions } = usePermissionsQuery();

    return computed(
        () =>
            project.value?.isPublic === true &&
            !canCreateMission(projectUuid.value, permissions.value),
    );
};
