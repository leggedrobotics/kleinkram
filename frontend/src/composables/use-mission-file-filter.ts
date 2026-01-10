import { FileType, HealthStatus } from '@kleinkram/shared';
import { useQuery } from '@tanstack/vue-query';
import { useHandler } from 'src/hooks/query-hooks';
import { formatDate, parseDate } from 'src/services/date-formating';
import { allTopicsNames, allTopicTypes } from 'src/services/queries/topic';
import { FileTypeOption } from 'src/types/file-type-option';
import { computed, reactive, ref, watch } from 'vue';

export interface MissionFilterState {
    filter: string; // filename
    health: HealthStatus | undefined;
    categories: string[]; // UUIDs
    startDates: string;
    endDates: string;
    selectedTopics: string[];
    selectedDatatypes: string[];
    matchAllTopics: boolean;
    fileTypeFilter: FileTypeOption[] | undefined;
    tagFilter: Record<string, { name: string; value: string }>;
}

export const DEFAULT_MISSION_STATE = (): MissionFilterState => {
    const start = new Date(0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const allFileTypes = Object.values(FileType)
        .filter((t) => t !== FileType.ALL)
        .map((name) => ({
            name,
            value: true,
        }));

    return {
        filter: '',
        health: undefined,
        categories: [],
        startDates: formatDate(start),
        endDates: formatDate(end),
        selectedTopics: [],
        selectedDatatypes: [],
        matchAllTopics: false,
        fileTypeFilter: allFileTypes,
        tagFilter: {},
    };
};

export function useMissionFileFilter() {
    const handler = useHandler();

    const defaultState = DEFAULT_MISSION_STATE();

    // Sync from URL (handler) if present
    if (handler.value.searchParams.name) {
        defaultState.filter = handler.value.searchParams.name;
    }
    if (handler.value.searchParams.health) {
        // @ts-ignore
        defaultState.health = handler.value.searchParams.health as HealthStatus;
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (handler.value.categories) {
        defaultState.categories = handler.value.categories;
    }
    if (handler.value.searchParams.startDate) {
        defaultState.startDates = handler.value.searchParams.startDate;
    }
    if (handler.value.searchParams.endDate) {
        defaultState.endDates = handler.value.searchParams.endDate;
    }
    if (handler.value.searchParams.messageDatatypes) {
        defaultState.selectedDatatypes =
            handler.value.searchParams.messageDatatypes.split(',');
    }
    if (handler.value.searchParams.topics) {
        defaultState.selectedTopics =
            handler.value.searchParams.topics.split(',');
    }
    if (handler.value.searchParams.matchAllTopics) {
        defaultState.matchAllTopics =
            handler.value.searchParams.matchAllTopics === 'true';
    }

    // Sync FileTypes
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (handler.value.fileTypes && defaultState.fileTypeFilter) {
        const activeTypes = new Set(handler.value.fileTypes);
        defaultState.fileTypeFilter = defaultState.fileTypeFilter.map((ft) => ({
            ...ft,
            value: activeTypes.has(ft.name as FileType),
        }));
    }

    const state = reactive<MissionFilterState>(defaultState);

    // -- Queries for Options --
    const { data: allTopics } = useQuery<string[]>({
        queryKey: ['topics'],
        queryFn: allTopicsNames,
    });

    const { data: allDatatypes } = useQuery<string[]>({
        queryKey: ['topicTypes'],
        queryFn: allTopicTypes,
    });

    // -- Computed --
    const startDate = computed(() => parseDate(state.startDates));
    const endDate = computed(() => parseDate(state.endDates));

    const selectedFileTypesFilter = computed<FileType[]>(() => {
        const list = state.fileTypeFilter ?? [];
        return list
            .filter((option) => option.value)
            .map((option) => option.name) as FileType[];
    });

    const tagFilterQuery = computed(() => {
        const query: Record<string, string> = {};
        for (const key of Object.keys(state.tagFilter)) {
            const value = state.tagFilter[key]?.value;

            if (value === undefined || value === '') continue;

            if (typeof value === 'string') {
                if (value.trim() !== '') {
                    query[key] = value;
                }
            } else {
                // Handle numbers, booleans, dates
                query[key] = String(value);
            }
        }
        return query;
    });

    // -- Actions --
    function resetStartDate(): void {
        const defaultS = DEFAULT_MISSION_STATE();
        state.startDates = defaultS.startDates;
    }

    function resetEndDate(): void {
        const defaultS = DEFAULT_MISSION_STATE();
        state.endDates = defaultS.endDates;
    }

    function resetFilter(): void {
        handler.value.setSearch({ name: '', health: '' });
        handler.value.setCategories([]);

        // Preserve fileTypeFilter structure if it exists, just selecting all
        const currentFileTypes = state.fileTypeFilter;

        Object.assign(state, DEFAULT_MISSION_STATE());

        if (currentFileTypes) {
            state.fileTypeFilter = currentFileTypes.map((it) => ({
                ...it,
                value: true,
            }));
        }
    }

    function useAndTopicFilter(): void {
        state.matchAllTopics = true;
    }

    function useOrTopicFilter(): void {
        state.matchAllTopics = false;
    }

    // -- Debounce Logic --
    const debouncedFilter = ref(state.filter);
    let timeout: ReturnType<typeof setTimeout>;

    watch(
        () => state.filter,
        (value: string) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                debouncedFilter.value = value;
            }, 300);
        },
    );

    watch(
        () => handler.value.categories,
        (newCategories) => {
            state.categories = newCategories;
        },
    );

    return {
        state,
        startDate,
        endDate,
        selectedFileTypesFilter,
        tagFilterQuery,
        debouncedFilter,
        allTopics,
        allDatatypes,
        resetStartDate,
        resetEndDate,
        resetFilter,
        useAndTopicFilter,
        useOrTopicFilter,
    };
}
