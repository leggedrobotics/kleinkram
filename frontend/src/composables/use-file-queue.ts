import type {
    CancelProcessingResponseDto,
    DeleteMissionResponseDto,
    FileQueueEntriesDto,
} from '@kleinkram/api-dto';
import {
    useMutation,
    UseMutationReturnType,
    useQuery,
    useQueryClient,
    UseQueryReturnType,
} from '@tanstack/vue-query';
import { fileKeys } from 'src/api/keys/file-keys';
import {
    cancelProcessing,
    deleteQueueItem,
    getQueue,
    stopQueueItem,
} from 'src/services/mutations/file';
import { computed, MaybeRef, unref } from 'vue';

export function useQueue(
    startDate: MaybeRef<string>,
    stateFilter: MaybeRef<string[]>,
    pagination: MaybeRef<{ skip: number; take: number }>,
): UseQueryReturnType<FileQueueEntriesDto, Error> {
    const queryKey = computed(() =>
        fileKeys.queue.list(startDate, stateFilter, pagination),
    );
    const enabled = computed(() => !!unref(startDate));

    return useQuery<FileQueueEntriesDto>({
        queryKey,
        queryFn: async () =>
            await getQueue(
                unref(startDate),
                unref(stateFilter),
                unref(pagination),
            ),
        refetchInterval: 1000,
        enabled,
    });
}

export function useDeleteQueueItem(): UseMutationReturnType<
    DeleteMissionResponseDto,
    Error,
    { missionUUID: string; queueUUID: string },
    unknown
> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (params: { missionUUID: string; queueUUID: string }) =>
            deleteQueueItem(params.missionUUID, params.queueUUID),
        onSuccess: () => {
            return queryClient.invalidateQueries({
                queryKey: fileKeys.queue.all,
            });
        },
    });
}

export function useCancelProcessing(): UseMutationReturnType<
    CancelProcessingResponseDto,
    Error,
    { missionUUID: string; queueUUID: string },
    unknown
> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (params: { missionUUID: string; queueUUID: string }) =>
            cancelProcessing(params.queueUUID, params.missionUUID),
        onSuccess: () => {
            return queryClient.invalidateQueries({
                queryKey: fileKeys.queue.all,
            });
        },
    });
}

export function useStopQueueItem(): UseMutationReturnType<
    { success: boolean },
    Error,
    string,
    unknown
> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (queueUUID: string) => stopQueueItem(queueUUID),
        onSuccess: () => {
            return queryClient.invalidateQueries({
                queryKey: fileKeys.queue.all,
            });
        },
    });
}
