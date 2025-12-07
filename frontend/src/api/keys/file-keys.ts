import { MaybeRef, unref } from 'vue';

const queueAll = ['files', 'queue'] as const;
const queueLists = [...queueAll, 'list'] as const;

export const fileKeys = {
    all: ['files'] as const,
    queue: {
        all: queueAll,
        lists: () => queueLists,
        list: (
            startDate: MaybeRef<string>,
            stateFilter: MaybeRef<string[]>,
            pagination: MaybeRef<{ skip: number; take: number }>,
        ) =>
            [
                ...queueLists,
                unref(startDate),
                unref(stateFilter),
                unref(pagination),
            ] as const,
    },
};
