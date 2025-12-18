<template>
    <!-- eslint-disable vue/no-mutating-props -->
    <div class="column q-gutter-y-md" style="min-width: 300px; padding: 16px">
        <div class="text-h6">Advanced Filters</div>
        <div
            v-if="showHint"
            class="text-caption text-grey-7 bg-grey-2 q-pa-sm rounded-borders row items-start no-wrap"
        >
            <div class="col">
                We use logical <b>AND</b>s between different search criteria and
                logical <b>OR</b> between the same keywords.<br />
                For topics, use <code>&topic:</code> prefix for
                <b>AND</b> matching.<br />
                Examples:<br />
                • <code>project:A mission:B</code> → files in mission B
                <b>AND</b> project A<br />
                • <code>project:P1 topic:A topic:B</code> → files with topic A
                which are in project P1 <b>OR</b> files with topic B which are
                in project P1<br />
                • <code>project:P1 &topic:A &topic:B</code> → files with topic A
                <b>AND</b> topic B which are in project P1
            </div>
            <q-btn
                flat
                dense
                round
                size="sm"
                icon="sym_o_close"
                class="col-auto q-ml-sm"
                @click="closeHint"
            />
        </div>

        <!-- Scope (Project / Mission) -->
        <ScopeSelector
            layout="column"
            :show-labels="true"
            :project-uuid="currentProjectUuid"
            :mission-uuid="currentMissionUuid"
            @update:project-uuid="updateProject"
            @update:mission-uuid="updateMission"
        />

        <div class="column q-gutter-y-sm">
            <div class="column q-gutter-y-xs">
                <label class="text-weight-bold">File Type</label>
                <FileTypeSelector
                    v-model="state.fileTypeFilter"
                    class="full-width"
                />
            </div>
            <div class="column q-gutter-y-xs">
                <label class="text-weight-bold">ROS Message Topics</label>
                <div class="row items-stretch no-wrap">
                    <q-btn-dropdown
                        unelevated
                        dense
                        color="grey-2"
                        text-color="grey-8"
                        no-caps
                        class="and-or-btn"
                        :label="state.matchAllTopics ? 'And' : 'Or'"
                        content-class="bg-white"
                    >
                        <q-list dense>
                            <q-item
                                v-close-popup
                                clickable
                                @click="setMatchAny"
                            >
                                <q-item-section>Or</q-item-section>
                            </q-item>
                            <q-item
                                v-close-popup
                                clickable
                                @click="setMatchAll"
                            >
                                <q-item-section>And</q-item-section>
                            </q-item>
                        </q-list>
                    </q-btn-dropdown>
                    <q-select
                        v-model="state.selectedTopics"
                        outlined
                        dense
                        multiple
                        use-chips
                        :options="filteredTopics"
                        use-input
                        clearable
                        bg-color="white"
                        :placeholder="topicsPlaceholder"
                        class="col-grow topics-select"
                        @filter="filterTopics"
                        @clear="clearTopics"
                    />
                </div>
            </div>
            <div class="column q-gutter-y-xs">
                <label class="text-weight-bold">ROS Message Datatypes</label>
                <q-select
                    v-model="state.selectedDatatypes"
                    outlined
                    dense
                    multiple
                    use-chips
                    :options="filteredDatatypes"
                    use-input
                    clearable
                    bg-color="white"
                    :placeholder="datatypesPlaceholder"
                    class="full-width"
                    @filter="filterDatatypes"
                    @clear="clearDatatypes"
                />
            </div>
        </div>

        <!-- Dates -->
        <div class="column q-gutter-y-xs">
            <label class="text-weight-bold">Date Range</label>
            <div class="row q-gutter-x-sm">
                <SelectionButtonGroup
                    :options="dateOptions"
                    :model-value="dateShortcutState"
                    type="single"
                    @update:model-value="onDateSelectionUpdate"
                />
            </div>
            <q-slide-transition>
                <div v-if="showDateInputs" class="row q-gutter-x-sm">
                    <div class="col">
                        <q-input
                            v-model="startDateProxy"
                            label="Start Date"
                            dense
                            outlined
                            readonly
                        >
                            <template #append>
                                <q-icon
                                    name="sym_o_event"
                                    class="cursor-pointer"
                                >
                                    <q-popup-proxy
                                        cover
                                        transition-show="scale"
                                        transition-hide="scale"
                                    >
                                        <q-date
                                            v-model="startDateProxy"
                                            :mask="dateMaskDateOnly"
                                        >
                                            <div
                                                class="row items-center justify-end"
                                            >
                                                <q-btn
                                                    v-close-popup
                                                    label="Close"
                                                    color="primary"
                                                    flat
                                                />
                                            </div>
                                        </q-date>
                                    </q-popup-proxy>
                                </q-icon>
                            </template>
                        </q-input>
                    </div>
                    <div class="col">
                        <q-input
                            v-model="endDateProxy"
                            label="End Date"
                            dense
                            outlined
                            readonly
                        >
                            <template #append>
                                <q-icon
                                    name="sym_o_event"
                                    class="cursor-pointer"
                                >
                                    <q-popup-proxy
                                        cover
                                        transition-show="scale"
                                        transition-hide="scale"
                                    >
                                        <q-date
                                            v-model="endDateProxy"
                                            :mask="dateMaskDateOnly"
                                        >
                                            <div
                                                class="row items-center justify-end"
                                            >
                                                <q-btn
                                                    v-close-popup
                                                    label="Close"
                                                    color="primary"
                                                    flat
                                                />
                                            </div>
                                        </q-date>
                                    </q-popup-proxy>
                                </q-icon>
                            </template>
                        </q-input>
                    </div>
                </div>
            </q-slide-transition>
        </div>

        <!-- Metadata Filters -->
        <div class="column q-gutter-y-xs">
            <label class="text-weight-bold">Mission Metadata</label>
            <MetadataFilterBuilder v-model="state.tagFilter" />
        </div>

        <div class="row justify-end q-mt-sm">
            <q-btn
                outline
                label="Reset All"
                class="text-black"
                @click="onReset"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import ScopeSelector from 'components/common/scope-selector.vue';
import FileTypeSelector from 'components/file-type-selector.vue';
import { FilterState } from 'src/composables/use-file-filter';
import { formatDate } from 'src/services/date-formating';
import { ref, watch } from 'vue';
import MetadataFilterBuilder from './metadata-filter-builder.vue';

// Local ref - resets on page reload, hint reappears each session
const showHint = ref(true);

const props = defineProps<{
    state: FilterState;
    currentProjectUuid?: string | undefined;
    currentMissionUuid?: string | undefined;
    topics?: string[];
    datatypes?: string[];
    applyDateShortcut: (
        type: 'today' | '7days' | 'lastmonth' | 'ytd' | 'all',
    ) => void;
}>();

const emit = defineEmits<{
    (
        event: 'update-project' | 'update-mission',
        uuid: string | undefined,
    ): void;
    (event: 'reset'): void;
}>();

import { computed } from 'vue';

const dateShortcutState = computed(() => {
    const { startDates, endDates } = props.state;
    // If empty strings, it's 'all'
    if (!startDates && !endDates) return 'all';

    // Helper to get formatted date string for comparisons
    const getFormatted = (d: Date) => formatDate(d);

    const today = new Date();
    // End of today (23:59:59)
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    const todayEndString = getFormatted(todayEnd);

    // Start of today (00:00:00)
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartString = getFormatted(todayStart);

    // Check 'All' (Epoch Start)
    const epoch = new Date(0);
    const epochString = getFormatted(epoch);
    if (startDates === epochString && endDates === todayEndString) return 'all';

    // Check 'Today'
    if (startDates === todayStartString && endDates === todayEndString)
        return 'today';

    // Check 'Last 7 Days'
    const last7 = new Date(today);
    last7.setDate(today.getDate() - 7);
    last7.setHours(0, 0, 0, 0); // Start of day
    if (startDates === getFormatted(last7) && endDates === todayEndString)
        return '7days';

    // Check 'Last Month'
    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);
    lastMonth.setHours(0, 0, 0, 0);
    if (startDates === getFormatted(lastMonth) && endDates === todayEndString)
        return 'lastmonth';

    // Check 'YTD'
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    startOfYear.setHours(0, 0, 0, 0);
    if (startDates === getFormatted(startOfYear) && endDates === todayEndString)
        return 'ytd';

    return 'custom';
});

// Date Proxies to handle "Date Only" UI but "Date+Time" State
const dateMaskDateOnly = 'DD.MM.YYYY';

const startDateProxy = computed({
    get: () => {
        if (!props.state.startDates) return '';
        return props.state.startDates.split(' ')[0] ?? '';
    },
    set: (value: string | null) => {
        if (!value) return; // handle clear?
        // Append start of day
        // eslint-disable-next-line vue/no-mutating-props
        props.state.startDates = `${value} 00:00`;
    },
});

const endDateProxy = computed({
    get: () => {
        if (!props.state.endDates) return '';
        return props.state.endDates.split(' ')[0] ?? '';
    },
    set: (value: string | null) => {
        if (!value) return;
        // Append end of day
        // eslint-disable-next-line vue/no-mutating-props
        props.state.endDates = `${value} 23:59`;
    },
});

function updateProject(value: string | undefined) {
    emit('update-project', value);
}
function updateMission(value: string | undefined) {
    emit('update-mission', value);
}

function closeHint() {
    showHint.value = false;
}

function setMatchAny() {
    // eslint-disable-next-line vue/no-mutating-props
    props.state.matchAllTopics = false;
}

function setMatchAll() {
    // eslint-disable-next-line vue/no-mutating-props
    props.state.matchAllTopics = true;
}

function clearTopics() {
    // eslint-disable-next-line vue/no-mutating-props
    props.state.selectedTopics = [];
}

function clearDatatypes() {
    // eslint-disable-next-line vue/no-mutating-props
    props.state.selectedDatatypes = [];
}

function onReset() {
    emit('reset');
}

// --- Local Filtering for Dropdowns ---
const filteredTopics = ref<string[]>([]);
const filteredDatatypes = ref<string[]>([]);

// UI State
const showDateInputs = ref(false);

import SelectionButtonGroup from 'components/common/selection-button-group.vue';

const dateOptions = [
    { label: 'All', value: 'all', special: true },
    { label: 'Today', value: 'today' },
    { label: 'Last 7 Days', value: '7days' },
    { label: 'Last Month', value: 'lastmonth' },
    {
        label: 'YTD',
        value: 'ytd',
        tooltip: 'Year To Date - from January 1st to today',
    },
    { label: 'Custom', value: 'custom', icon: 'sym_o_calendar_month' },
];

function onDateSelectionUpdate(value: string | string[]) {
    // Single select, val is string
    if (Array.isArray(value)) return; // Should not happen with type='single'

    if (value === 'custom') {
        showDateInputs.value = !showDateInputs.value;
    } else {
        props.applyDateShortcut(
            value as 'all' | 'today' | '7days' | 'lastmonth' | 'ytd',
        );
        showDateInputs.value = false;
    }
}

// Initialize with props
watch(
    () => props.topics,
    (value) => {
        filteredTopics.value = value ?? [];
    },
    { immediate: true },
);

watch(
    () => props.datatypes,
    (value) => {
        filteredDatatypes.value = value ?? [];
    },
    { immediate: true },
);

function filterTopics(value: string, update: (function_: () => void) => void) {
    if (value === '') {
        update(() => {
            filteredTopics.value = props.topics ?? [];
        });
        return;
    }
    update(() => {
        const needle = value.toLowerCase();
        filteredTopics.value = (props.topics ?? []).filter((v) =>
            v.toLowerCase().includes(needle),
        );
    });
}

function filterDatatypes(
    value: string,
    update: (function_: () => void) => void,
) {
    if (value === '') {
        update(() => {
            filteredDatatypes.value = props.datatypes ?? [];
        });
        return;
    }
    update(() => {
        const needle = value.toLowerCase();
        filteredDatatypes.value = (props.datatypes ?? []).filter((v) =>
            v.toLowerCase().includes(needle),
        );
    });
}

// Dynamic placeholders showing first available option
const topicsPlaceholder = computed(() => {
    const first = props.topics?.[0];
    return first ? `e.g. ${first}` : 'Select topics...';
});

const datatypesPlaceholder = computed(() => {
    const first = props.datatypes?.[0];
    return first ? `e.g. ${first}` : 'Select datatypes...';
});
</script>

<style scoped>
.and-or-btn {
    border: 1px solid rgba(0, 0, 0, 0.24);
    border-right: none;
    border-radius: 4px 0 0 4px;
    min-height: 40px;
}

.topics-select :deep(.q-field__control) {
    border-radius: 0 4px 4px 0;
}
</style>
