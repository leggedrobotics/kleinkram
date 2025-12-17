<template>
    <div
        class="q-pa-md q-mt-md bg-grey-1 rounded-borders q-mb-md border-grey-3"
        style="border: 1px solid #e0e0e0"
    >
        <div class="row q-col-gutter-sm q-mb-sm">
            <div class="col-12 col-sm-6 col-md-3">
                <q-input
                    v-model="state.startDates"
                    filled
                    dense
                    outlined
                    bg-color="white"
                    label="Start Date"
                    @clear="useFilter.resetStartDate"
                >
                    <template #append>
                        <q-icon name="sym_o_event" class="cursor-pointer">
                            <q-popup-proxy
                                cover
                                transition-show="scale"
                                transition-hide="scale"
                            >
                                <q-date
                                    v-model="state.startDates"
                                    :mask="dateMask"
                                >
                                    <div class="row items-center justify-end">
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

            <div class="col-12 col-sm-6 col-md-3">
                <q-input
                    v-model="state.endDates"
                    filled
                    dense
                    outlined
                    bg-color="white"
                    label="End Date"
                    @clear="useFilter.resetEndDate"
                >
                    <template #append>
                        <q-icon name="sym_o_event" class="cursor-pointer">
                            <q-popup-proxy
                                cover
                                transition-show="scale"
                                transition-hide="scale"
                            >
                                <q-date
                                    v-model="state.endDates"
                                    :mask="dateMask"
                                >
                                    <div class="row items-center justify-end">
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

            <div class="col-12 col-md-6">
                <ScopeSelector
                    layout="row"
                    :show-labels="true"
                    class="full-width"
                />
                <q-tooltip v-if="!handler.projectUuid" self="bottom middle">
                    Please select a project first
                </q-tooltip>
            </div>
        </div>

        <div class="row q-col-gutter-sm items-center">
            <div class="col-12 col-sm-4 col-md-2">
                <file-type-selector
                    ref="fileTypeSelectorReference"
                    v-model="state.fileTypeFilter"
                />
            </div>

            <div class="col-12 col-sm-8 col-md-5">
                <div class="row no-wrap q-col-gutter-xs">
                    <div class="col-auto">
                        <q-btn-dropdown
                            unelevated
                            outline
                            color="grey-4"
                            text-color="black"
                            dense
                            class="bg-white full-height"
                            no-caps
                        >
                            <template #label>
                                <span class="text-weight-regular">{{
                                    state.matchAllTopics ? 'And' : 'Or'
                                }}</span>
                            </template>
                            <q-list>
                                <q-item
                                    clickable
                                    @click="useFilter.useAndTopicFilter"
                                >
                                    <q-item-section>And</q-item-section>
                                </q-item>
                                <q-item
                                    clickable
                                    @click="useFilter.useOrTopicFilter"
                                >
                                    <q-item-section>Or</q-item-section>
                                </q-item>
                            </q-list>
                        </q-btn-dropdown>
                    </div>
                    <div class="col">
                        <q-select
                            v-model="state.selectedTopics"
                            label="Filter by Topics"
                            use-input
                            input-debounce="20"
                            outlined
                            dense
                            bg-color="white"
                            multiple
                            use-chips
                            :options="displayedTopics"
                            emit-value
                            map-options
                            class="full-width"
                            @filter="filterTopics"
                        />
                    </div>
                </div>
            </div>

            <div class="col-12 col-sm-8 col-md-5">
                <div class="row no-wrap q-col-gutter-xs">
                    <div class="col-8">
                        <q-select
                            v-model="state.selectedDatatypes"
                            label="Filter by Datatype"
                            use-input
                            input-debounce="20"
                            outlined
                            dense
                            bg-color="white"
                            multiple
                            use-chips
                            :options="displayedDatatypes"
                            class="full-width"
                            @filter="filterDatatypes"
                        />
                    </div>
                </div>
            </div>

            <div class="col-12 col-sm-8 col-md-3">
                <q-input
                    v-model="state.filter"
                    outlined
                    dense
                    bg-color="white"
                    debounce="300"
                    clearable
                    placeholder="Search Filename"
                    class="full-width"
                >
                    <template #append>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>
            </div>

            <div class="col-12 col-sm-4 col-md-2 text-right">
                <div class="row justify-end q-gutter-x-sm">
                    <q-btn
                        v-if="state.tagFilter"
                        flat
                        dense
                        round
                        icon="sym_o_sell"
                        color="primary"
                        @click="openTagFilterDialog"
                    >
                        <q-tooltip>Advanced Tag Filter</q-tooltip>
                        <q-badge
                            v-if="Object.values(state.tagFilter).length > 0"
                            color="red"
                            floating
                        >
                            {{ Object.values(state.tagFilter).length }}
                        </q-badge>
                    </q-btn>

                    <q-btn
                        unelevated
                        color="grey-4"
                        text-color="black"
                        label="Reset"
                        icon="sym_o_refresh"
                        no-caps
                        class="full-height"
                        @click="onResetFilter"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import ScopeSelector from 'components/common/scope-selector.vue';
import FileTypeSelector from 'components/file-type-selector.vue';
import { useQuasar } from 'quasar';
import { useFileFilter } from 'src/composables/use-file-filter';
import TagFilter from 'src/dialogs/tag-filter.vue';
import { useHandler } from 'src/hooks/query-hooks';
import { dateMask } from 'src/services/date-formating';
import { ref } from 'vue';

const props = defineProps<{
    useFilter: ReturnType<typeof useFileFilter>;
}>();

const { state, allTopics, allDatatypes } = props.useFilter;

const handler = useHandler();
const $q = useQuasar();

const fileTypeSelectorReference = ref<
    { setAll?: (value: boolean) => void } | undefined
>(undefined);

const displayedTopics = ref<string[]>([]);
const displayedDatatypes = ref<string[]>([]);

function filterTopics(value: string, update: (function_: () => void) => void) {
    if (value === '') {
        update(() => {
            displayedTopics.value = allTopics.value ?? [];
        });
        return;
    }
    update(() => {
        const needle = value.toLowerCase();
        displayedTopics.value =
            allTopics.value?.filter((v) => v.toLowerCase().includes(needle)) ??
            [];
    });
}

function filterDatatypes(
    value: string,
    update: (function_: () => void) => void,
) {
    if (value === '') {
        update(() => {
            displayedDatatypes.value = allDatatypes.value ?? [];
        });
        return;
    }
    update(() => {
        const needle = value.toLowerCase();
        displayedDatatypes.value =
            allDatatypes.value?.filter((v) =>
                v.toLowerCase().includes(needle),
            ) ?? [];
    });
}

function openTagFilterDialog(): void {
    $q.dialog({
        title: 'Filter by Metadata',
        component: TagFilter,
        componentProps: { tagValues: state.tagFilter },
    }).onOk((_tagFilter: Record<string, { name: string; value: string }>) => {
        state.tagFilter = _tagFilter;
    });
}

function onResetFilter(): void {
    props.useFilter.resetFilter();
    if (
        fileTypeSelectorReference.value &&
        typeof fileTypeSelectorReference.value.setAll === 'function'
    ) {
        fileTypeSelectorReference.value.setAll(true);
    }
}
</script>
