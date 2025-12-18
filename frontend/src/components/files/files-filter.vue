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
                    :context-data="augmentedContext"
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
                <ComposableFilterPopup
                    :filters="filters"
                    :state="state"
                    :context="augmentedContext"
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
import ComposableFilterPopup from 'src/components/files/filter/composable-filter-popup.vue';
import { DEFAULT_STATE, useFileFilter } from 'src/composables/use-file-filter';
import { useFileSearch } from 'src/composables/use-file-search';
import { KEYWORDS, useFilterParser } from 'src/composables/use-filter-parser';
import { useFilterSync } from 'src/composables/use-filter-sync';
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

const {
    draftProjectUuid,
    draftMissionUuid,
    projectUuid,
    missionUuid,
    setProjectUUID,
    setMissionUUID,
} = useFilterSync(handler, () => {
    refresh();
});

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
const { provider, filters, contextData, projects, missions } = useFileSearch(
    projectUuid,
    missionUuid,
    (uuid) => {
        draftProjectUuid.value = uuid;
    },
    (uuid) => {
        draftMissionUuid.value = uuid;
    },
);

// Augmented Context for Popup
const augmentedContext = computed(() => ({
    ...contextData.value,
    projectUuid: draftProjectUuid.value,
    missionUuid: draftMissionUuid.value,
    setProject: setProjectUUID,
    setMission: setMissionUUID,
}));

// Derive Keys from filters
const highlightKeys = computed(() => [
    ...filters.map((f) => f.key),
    KEYWORDS.TOPIC_AND,
]);

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
    filters,
    () => augmentedContext.value,
    {
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
watch(filterText, (_newValue) => {
    // NOTE: parse(newValue) is removed here because:
    // 1. User input is handled by onFilterUpdate (calls parse explicitly)
    // 2. URL changes are handled by the handler watch (calls parse explicitly)
    // 3. Advanced UI changes are handled by the filterString watch (DO NOT call parse to avoid circular state loss)
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

// Redundant watch removed, filterString watcher handles this more accurately.
// BUT: On initial page load, projects/missions may not have loaded yet when filterString is first computed.
// We need to re-sync filterText when projects or missions data becomes available.
watch([projects, missions], () => {
    // Only re-sync if this appears to be an initial load (URL has project/missionUuid but text is stale/empty)
    const hasProjectInUrl = !!handler.value.projectUuid;
    const hasMissionInUrl = !!handler.value.missionUuid;
    const hasProjectInText = filterText.value
        .toLowerCase()
        .includes('project:');
    const hasMissionInText = filterText.value
        .toLowerCase()
        .includes('mission:');

    // If URL has scopes that aren't in the text yet, we should re-sync
    if (
        ((hasProjectInUrl && !hasProjectInText) ||
            (hasMissionInUrl && !hasMissionInText)) &&
        !isUpdatingFromInput.value &&
        filterString.value !== filterText.value
    ) {
        filterText.value = filterString.value;
    }
});

// Helper to reconstruct full filter string including stripped project/mission
const quote = (s: string) => (s.includes(' ') ? `"${s}"` : s);

function reconstructFullFilter(baseFilter = ''): string {
    let text = baseFilter;

    // Re-inject Project if missing in text but present in URL
    if (handler.value.projectUuid && !text.toLowerCase().includes('project:')) {
        const p = projects.value.find(
            (x) => x.uuid === handler.value.projectUuid,
        );
        // Fallback to UUID if name not found (though useFileSearch usually provides a fallback)
        const pName = p?.name ?? handler.value.projectUuid;
        if (pName) {
            text = `${text} project:${quote(pName)}`.trim();
        }
    }

    // Re-inject Mission if missing in text but present in URL
    if (handler.value.missionUuid && !text.toLowerCase().includes('mission:')) {
        const m = missions.value.find(
            (x) => x.uuid === handler.value.missionUuid,
        );
        const mName = m?.name ?? handler.value.missionUuid;
        if (mName) {
            text = `${text} mission:${quote(mName)}`.trim();
        }
    }

    return text;
}

// Parse initial filter from URL on mount (to restore topics, etc.)
onMounted(() => {
    // If there's a filter in state (from URL) or handler search param, parse it
    const rawFilter =
        props.useFilter.state.filter || handler.value.searchParams.name;

    if (rawFilter || handler.value.projectUuid || handler.value.missionUuid) {
        const fullFilter = reconstructFullFilter(rawFilter);
        filterText.value = fullFilter;
        parse(fullFilter);
    }
});

// Watch for external URL changes to 'name' param
watch(
    () => handler.value.searchParams.name,
    (newValue) => {
        if (!isUpdatingFromInput.value) {
            const fullFilter = reconstructFullFilter(newValue);
            if (fullFilter !== filterText.value) {
                filterText.value = fullFilter;
                parse(fullFilter);
            }
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
    filterText.value = '';
    // Also clear project/mission drafts
    draftProjectUuid.value = undefined;
    draftMissionUuid.value = undefined;
    // Trigger refresh to update URL
    refresh();
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
