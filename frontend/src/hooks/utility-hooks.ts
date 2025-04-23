import { Paginated } from '@api/types/pagination';
import { ref, Ref, unref, watch } from 'vue';

/**
 * Returns a ref of the data of a paginated response (computed ref)
 * This is useful to convert an API response to a reactive object
 * that can be edited in the frontend.
 *
 * @param paginatedResponse
 */
export const useEditablePaginatedResponse = <T>(
    paginatedResponse: Ref<Paginated<T> | undefined>,
): Ref<T[]> => {
    const editableResponse = ref<T[]>([]) as Ref<T[]>;

    watch(
        paginatedResponse,
        () => {
            editableResponse.value = unref(paginatedResponse)?.data ?? [];
        },
        { immediate: true },
    );

    return editableResponse;
};
