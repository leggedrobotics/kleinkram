import { FileType } from '@kleinkram/shared';
import { useQuery } from '@tanstack/vue-query';
import { useHandler } from 'src/hooks/query-hooks';
import { formatDate, parseDate } from 'src/services/date-formating';
import { allTopicsNames, allTopicTypes } from 'src/services/queries/topic';
import { FileTypeOption } from 'src/types/file-type-option';
import { computed, reactive, ref, watch } from 'vue';

export interface FilterState {
    filter: string;
    startDates: string;
    endDates: string;
    selectedTopics: string[];
    selectedDatatypes: string[];
    matchAllTopics: boolean;
    fileTypeFilter: FileTypeOption[] | undefined;
    tagFilter: Record<string, { name: string; value: string }>;
}

export const DEFAULT_STATE = (): FilterState => {
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
        startDates: formatDate(start),
        endDates: formatDate(end),
        selectedTopics: [],
        selectedDatatypes: [],
        matchAllTopics: false,
        fileTypeFilter: allFileTypes,
        tagFilter: {},
    };
};

export function useFileFilter() {
    const handler = useHandler();

    const defaultState = DEFAULT_STATE();

    // Sync from URL (handler) if present
    if (handler.value.searchParams.name) {
        defaultState.filter = handler.value.searchParams.name;
    }
    if (handler.value.searchParams.startDate) {
        defaultState.startDates = handler.value.searchParams.startDate;
    }
    if (handler.value.searchParams.endDate) {
        defaultState.endDates = handler.value.searchParams.endDate;
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

    const state = reactive<FilterState>(defaultState);

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
        const defaultS = DEFAULT_STATE();
        state.startDates = defaultS.startDates;
    }

    function resetEndDate(): void {
        const defaultS = DEFAULT_STATE();
        state.endDates = defaultS.endDates;
    }

    function resetFilter(): void {
        handler.value.setProjectUUID(undefined);
        handler.value.setMissionUUID(undefined);
        handler.value.setSearch({ name: '' });

        // Preserve fileTypeFilter structure if it exists, just selecting all
        const currentFileTypes = state.fileTypeFilter;

        Object.assign(state, DEFAULT_STATE());

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

    function applyDateShortcut(
        type: 'today' | '7days' | 'lastmonth' | 'ytd' | 'all',
    ): void {
        if (type === 'all') {
            resetStartDate();
            resetEndDate();
            // Clear from Search params
            const newParameters = { ...handler.value.searchParams };
            delete newParameters.startDate;
            delete newParameters.endDate;

            handler.value.setSearch({
                ...newParameters,
                startDate: undefined as unknown as string,
                endDate: undefined as unknown as string,
            });
            return;
        }

        const end = new Date();
        // End of day today
        end.setHours(23, 59, 59, 999);

        const start = new Date();
        start.setHours(0, 0, 0, 0);

        switch (type) {
            case 'today': {
                // start is already beginning of today
                break;
            }
            case '7days': {
                start.setDate(start.getDate() - 7);
                break;
            }
            case 'lastmonth': {
                // 1 month ago
                start.setMonth(start.getMonth() - 1);
                break;
            }
            case 'ytd': {
                // Jan 1st
                start.setMonth(0, 1);
                break;
            }
            // No default
        }

        const s = formatDate(start);
        const dateEnd = formatDate(end);
        state.startDates = s;
        state.endDates = dateEnd;

        // Immediately apply to handler (Search)
        handler.value.setSearch({
            ...handler.value.searchParams,
            startDate: s,
            endDate: dateEnd,
        });
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
        applyDateShortcut,
    };
}
