<template>
    <div class="column q-gutter-y-xs">
        <label class="text-weight-bold">Date Range</label>
        <div class="row q-gutter-x-sm">
            <SelectionButtonGroup
                :options="options"
                :model-value="dateShortcutState"
                type="single"
                @update:model-value="onDateSelectionUpdate"
            />
        </div>
        <q-slide-transition>
            <div v-if="showDateInputs" class="row q-gutter-x-sm">
                <div class="col">
                    <q-input
                        :model-value="startDateProxy"
                        label="Start Date"
                        dense
                        outlined
                        readonly
                        @update:model-value="updateStartDateProxy"
                    >
                        <template #append>
                            <q-icon name="sym_o_event" class="cursor-pointer">
                                <q-popup-proxy
                                    cover
                                    transition-show="scale"
                                    transition-hide="scale"
                                >
                                    <q-date
                                        :model-value="startDateProxy"
                                        :mask="dateMaskDateOnly"
                                        @update:model-value="handleDateUpdate"
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
                        :model-value="endDateProxy"
                        label="End Date"
                        dense
                        outlined
                        readonly
                        @update:model-value="updateEndDateProxy"
                    >
                        <template #append>
                            <q-icon name="sym_o_event" class="cursor-pointer">
                                <q-popup-proxy
                                    cover
                                    transition-show="scale"
                                    transition-hide="scale"
                                >
                                    <q-date
                                        :model-value="endDateProxy"
                                        :mask="dateMaskDateOnly"
                                        @update:model-value="updateEndDateProxy"
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
</template>

<script setup lang="ts">
import SelectionButtonGroup from 'components/common/selection-button-group.vue';
import { DEFAULT_STATE, FilterState } from 'src/composables/use-file-filter';
import { FileSearchContextData } from 'src/composables/use-file-search';
import { formatDate } from 'src/services/date-formating';
import { computed, PropType, ref, toRef } from 'vue';

const props = defineProps({
    state: {
        type: Object as PropType<FilterState>,
        required: true,
    },
    context: {
        type: Object as PropType<FileSearchContextData>,
        required: true,
    },
});

const startDatesReference = toRef(props.state, 'startDates');
const endDatesReference = toRef(props.state, 'endDates');

const dateMaskDateOnly = 'DD.MM.YYYY';

const options = [
    {
        label: 'All',
        value: 'all',
        special: true,
    },
    { label: 'Today', value: 'today' },
    {
        label: 'Last 7 Days',
        value: '7days',
    },
    {
        label: 'Last Month',
        value: 'lastmonth',
    },
    {
        label: 'YTD',
        value: 'ytd',
        tooltip: 'Year To Date',
    },
    {
        label: 'Custom',
        value: 'custom',
        icon: 'sym_o_calendar_month',
    },
];

const dateShortcutState = computed(() => {
    const startDates = startDatesReference.value;
    const endDates = endDatesReference.value;
    if (!startDates && !endDates) return 'all';

    const getFormatted = (d: Date) => formatDate(d);
    const today = new Date();
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    const todayEndString = getFormatted(todayEnd);
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartString = getFormatted(todayStart);
    const epoch = new Date(0);
    const epochString = getFormatted(epoch);

    if (startDates === epochString && endDates === todayEndString) return 'all';
    if (startDates === todayStartString && endDates === todayEndString)
        return 'today';

    const last7 = new Date(today);
    last7.setDate(today.getDate() - 7);
    last7.setHours(0, 0, 0, 0);
    if (startDates === getFormatted(last7) && endDates === todayEndString)
        return '7days';

    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);
    lastMonth.setHours(0, 0, 0, 0);
    if (startDates === getFormatted(lastMonth) && endDates === todayEndString)
        return 'lastmonth';

    const startOfYear = new Date(today.getFullYear(), 0, 1);
    startOfYear.setHours(0, 0, 0, 0);
    if (startDates === getFormatted(startOfYear) && endDates === todayEndString)
        return 'ytd';

    return 'custom';
});

const showDateInputs = ref(false);

function applyShortcut(type: 'today' | '7days' | 'lastmonth' | 'ytd' | 'all') {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    if (type === 'all') {
        const defaultState = DEFAULT_STATE();
        startDatesReference.value = defaultState.startDates;
        endDatesReference.value = defaultState.endDates;
        return;
    }

    switch (type) {
        case '7days': {
            start.setDate(start.getDate() - 7);
            break;
        }
        case 'lastmonth': {
            start.setMonth(start.getMonth() - 1);
            break;
        }
        case 'ytd': {
            start.setMonth(0, 1);
            break;
        }
    }

    startDatesReference.value = formatDate(start);
    endDatesReference.value = formatDate(end);
}

function onDateSelectionUpdate(
    value: string | string[] | number | number[] | null,
) {
    if (Array.isArray(value) || value === null || typeof value === 'number')
        return;
    if (value === 'custom') {
        showDateInputs.value = !showDateInputs.value;
    } else {
        applyShortcut(value as 'today' | '7days' | 'lastmonth' | 'ytd' | 'all');
        showDateInputs.value = false;
    }
}

const startDateProxy = computed({
    get: () => startDatesReference.value.split(' ')[0] ?? '',
    set: (v) => {
        if (v) startDatesReference.value = `${v} 00:00`;
    },
});
const endDateProxy = computed({
    get: () => endDatesReference.value.split(' ')[0] ?? '',
    set: (v) => {
        if (v) endDatesReference.value = `${v} 23:59`;
    },
});

function updateStartDateProxy(v: unknown) {
    startDateProxy.value = (v as string) || '';
}

function handleDateUpdate(v: string | null) {
    startDateProxy.value = v ?? '';
}

function updateEndDateProxy(v: unknown) {
    endDateProxy.value = (v as string) || '';
}
</script>
