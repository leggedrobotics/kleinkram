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

const DEFAULT_STATE = (): FilterState => {
    const start = new Date(0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return {
        filter: '',
        startDates: formatDate(start),
        endDates: formatDate(end),
        selectedTopics: [],
        selectedDatatypes: [],
        matchAllTopics: false,
        fileTypeFilter: undefined,
        tagFilter: {},
    };
};

export function useFileFilter() {
    const handler = useHandler();
    const state = reactive<FilterState>(DEFAULT_STATE());

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
            query[key] = state.tagFilter[key]?.value ?? '';
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
    };
}
