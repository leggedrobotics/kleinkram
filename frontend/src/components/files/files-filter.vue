<template>
    <div
        class="q-pa-md q-mt-md bg-grey-1 rounded-borders q-mb-md border-grey-3"
        style="border: 1px solid #e0e0e0"
    >
        <div class="row items-start no-wrap q-gutter-x-sm">
            <div class="col">
                <SmartSearchInput
                    :model-value="filterText"
                    :provider="provider"
                    :context-data="contextData"
                    :highlight-keys="highlightKeys"
                    :placeholder="placeholderText"
                    :validator="validateSyntax"
                    @update:model-value="onFilterUpdate"
                    @submit="refresh"
                    @toggle-advanced="toggleAdvanced"
                />
            </div>
            <div class="col-auto">
                <q-btn
                    unelevated
                    color="black"
                    icon="sym_o_search"
                    label="Search"
                    @click="refresh"
                />
            </div>
        </div>

        <q-slide-transition>
            <div v-if="showAdvanced">
                <q-separator class="q-my-sm" />
                <FilterPopup
                    :state="state"
                    :current-project-uuid="handler.projectUuid"
                    :current-mission-uuid="handler.missionUuid"
                    :topics="allTopics ?? []"
                    :datatypes="allDatatypes ?? []"
                    :apply-date-shortcut="props.useFilter.applyDateShortcut"
                    @update-project="setProjectUUID"
                    @update-mission="setMissionUUID"
                    @reset="onResetFilter"
                />
            </div>
        </q-slide-transition>
    </div>
</template>

<script setup lang="ts">
import SmartSearchInput from 'src/components/common/smart-search-input.vue';
import FilterPopup from 'src/components/files/filter/filter-popup.vue';
import { DEFAULT_STATE, useFileFilter } from 'src/composables/use-file-filter';
import { useFileSearch } from 'src/composables/use-file-search';
import { KEYWORDS, useFilterParser } from 'src/composables/use-filter-parser';
import { useHandler, useMission } from 'src/hooks/query-hooks';
import { PropType, computed, onMounted, ref, watch } from 'vue';

const props = defineProps({
    useFilter: {
        type: Object as PropType<ReturnType<typeof useFileFilter>>,
        required: true,
    },
});
defineEmits(['update:model-value']);

const { state } = props.useFilter;

const handler = useHandler();
const showAdvanced = ref(false);

const fileTypeSelectorReference = ref<
    { setAll?: (value: boolean) => void } | undefined
>(undefined);

// Draft State for Manual Trigger
const draftProjectUuid = ref<string | undefined>(handler.value.projectUuid);
const draftMissionUuid = ref<string | undefined>(handler.value.missionUuid);

// Sync draft from handler initially (and if URL changes externally)
watch(
    () => handler.value.projectUuid,
    (value) => {
        if (value !== draftProjectUuid.value) draftProjectUuid.value = value;
    },
);
watch(
    () => handler.value.missionUuid,
    (value) => {
        if (value !== draftMissionUuid.value) draftMissionUuid.value = value;
    },
);

const projectUuid = computed(
    () => draftProjectUuid.value ?? handler.value.projectUuid,
);

// Derive Project from Mission if missing
const { data: missionData } = useMission(
    computed(() => draftMissionUuid.value ?? ''),
);
watch(missionData, (m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const pUuid = ((m as any)?.project_uuid ?? (m as any)?.project?.uuid) as
        | string
        | undefined;
    if (pUuid && !draftProjectUuid.value) {
        draftProjectUuid.value = pUuid;
    }
});

// --- Use File Search Composable ---
const { provider, contextData, projects, missions, allTopics, allDatatypes } =
    useFileSearch(projectUuid);

const highlightKeys = Object.values(KEYWORDS);

const placeholderText = computed(() => {
    const exampleProject =
        projects.value.length > 0 ? projects.value[0]?.name : undefined;
    const name = exampleProject ?? 'MyProject';
    const projectString = name.includes(' ') ? `"${name}"` : name;
    return `Search (e.g. project:${projectString} filetype:bag ...)`;
});

// --- Parser Integration ---

const isUpdatingFromInput = ref(false);

function onFilterUpdate(value: string) {
    filterText.value = value;
    isUpdatingFromInput.value = true;
    parse(value);
    setTimeout(() => {
        isUpdatingFromInput.value = false;
    }, 0);
}

// Compute defaults once
const defaultState = DEFAULT_STATE();

const { filterString, parse, validateSyntax } = useFilterParser(
    state,
    () => {
        /* no-op */
    },
    {
        projects,
        missions,
        // The parser reads current DASHBOARD (Draft) state to resolve names
        projectUuid: computed(() => draftProjectUuid.value),
        missionUuid: computed(() => draftMissionUuid.value),
        setProject: (uuid) => {
            draftProjectUuid.value = uuid;
        },
        setMission: (uuid) => {
            draftMissionUuid.value = uuid;
        },
        defaultStartDate: defaultState.startDates,
        defaultEndDate: defaultState.endDates,
    },
);

// We want bidirectional binding:
const filterText = ref(filterString.value);

// Watch for external state changes to update the text
watch(filterString, (newValue) => {
    // Only update if the change did NOT originate from the input
    if (!isUpdatingFromInput.value && newValue !== filterText.value) {
        filterText.value = newValue;
    }
});

// Watch input changes from SmartFilterInput
watch(filterText, (newValue) => {
    parse(newValue);
});

// Watch Date and Filter Changes to trigger refresh automatically
watch(
    [
        () => props.useFilter.state.startDates,
        () => props.useFilter.state.endDates,
        () => props.useFilter.state.fileTypeFilter,
        () => props.useFilter.state.selectedTopics,
        () => props.useFilter.state.selectedDatatypes,
        () => props.useFilter.state.matchAllTopics,
        () => props.useFilter.state.tagFilter,
    ],
    () => {
        refresh();
    },
    { deep: true },
);

// Re-sync filterText when projects or missions load (to include them in search string after reload)
watch([projects, missions], () => {
    if (!isUpdatingFromInput.value && filterString.value !== filterText.value) {
        filterText.value = filterString.value;
    }
});

// Parse initial filter from URL on mount (to restore topics, etc.)
onMounted(() => {
    // If there's a filter in state (from URL) or handler search param, parse it
    const initialFilter =
        props.useFilter.state.filter || handler.value.searchParams.name;
    if (initialFilter) {
        filterText.value = initialFilter;
        parse(initialFilter);
    }
});

// Watch for external URL changes to 'name' param
watch(
    () => handler.value.searchParams.name,
    (newValue) => {
        if (!isUpdatingFromInput.value && newValue !== filterText.value) {
            filterText.value = newValue ?? '';
            parse(newValue ?? '');
        }
    },
);

watch(
    () => handler.value.searchParams.startDate,
    (newValue) => {
        const defaults = DEFAULT_STATE();
        if (newValue && newValue !== props.useFilter.state.startDates) {
            // eslint-disable-next-line vue/no-mutating-props
            props.useFilter.state.startDates = newValue;
        } else if (!newValue) {
            // Reset to default if URL param is missing
            // eslint-disable-next-line vue/no-mutating-props
            props.useFilter.state.startDates = defaults.startDates;
        }
    },
    { immediate: true },
);

watch(
    () => handler.value.searchParams.endDate,
    (newValue) => {
        const defaults = DEFAULT_STATE();
        if (newValue && newValue !== props.useFilter.state.endDates) {
            // eslint-disable-next-line vue/no-mutating-props
            props.useFilter.state.endDates = newValue;
        } else if (!newValue) {
            // eslint-disable-next-line vue/no-mutating-props
            props.useFilter.state.endDates = defaults.endDates;
        }
    },
    { immediate: true },
);

// --- Actions ---

function onResetFilter(): void {
    props.useFilter.resetFilter();
    // Also reset file types UI if needed
    if (
        fileTypeSelectorReference.value &&
        typeof fileTypeSelectorReference.value.setAll === 'function'
    ) {
        fileTypeSelectorReference.value.setAll(true);
    }
    filterText.value = '';
}

function setProjectUUID(v: string | undefined) {
    handler.value.setProjectUUID(v);
}

function setMissionUUID(v: string | undefined) {
    handler.value.setMissionUUID(v);
}

function toggleAdvanced() {
    showAdvanced.value = !showAdvanced.value;
}

function refresh() {
    // Apply draft selections to the actual handler (URL)
    handler.value.setProjectUUID(draftProjectUuid.value);
    handler.value.setMissionUUID(draftMissionUuid.value);

    // Merge dates from state (which might be manual custom inputs)
    const { startDates, endDates } = props.useFilter.state;

    // Save the full filterString (includes topics, datatypes, etc) to URL
    // But exclude Project/Mission if they are set via UUID to avoid redundancy in URL
    let nameForUrl = filterString.value;

    if (draftProjectUuid.value) {
        // Remove project: matches
        // Regex matches project:"..." or project:word, allowing for optional space before
        nameForUrl = nameForUrl.replaceAll(
            /(?:^|\s)project:(?:(?:"[^"]*")|(?:[^\s]*))/gi,
            '',
        );
    }
    if (draftMissionUuid.value) {
        nameForUrl = nameForUrl.replaceAll(
            /(?:^|\s)mission:(?:(?:"[^"]*")|(?:[^\s]*))/gi,
            '',
        );
    }

    // Clean up spaces
    nameForUrl = nameForUrl.replaceAll(/\s+/g, ' ').trim();

    const defaults = DEFAULT_STATE();
    const finalStart = startDates === defaults.startDates ? '' : startDates;
    const finalEnd = endDates === defaults.endDates ? '' : endDates;

    handler.value.setSearch({
        ...handler.value.searchParams,
        name: nameForUrl,
        startDate: finalStart,
        endDate: finalEnd,
    });
}
</script>
