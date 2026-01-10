<template>
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
                :label="matchAllTopicsReference ? 'And' : 'Or'"
                content-class="bg-white"
            >
                <q-list dense>
                    <q-item clickable @click="setMatchAny">
                        <q-item-section>Or</q-item-section>
                    </q-item>
                    <q-item clickable @click="setMatchAll">
                        <q-item-section>And</q-item-section>
                    </q-item>
                </q-list>
            </q-btn-dropdown>
            <q-select
                v-model="selectedTopicsReference"
                outlined
                dense
                multiple
                use-chips
                :options="filteredTopics"
                use-input
                clearable
                bg-color="white"
                placeholder="Select topics..."
                class="col-grow topics-select"
                @filter="filterTopics"
                @clear="clearTopics"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { FilterState } from 'src/composables/use-file-filter';
import { FileSearchContextData } from 'src/composables/use-file-search';
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

const selectedTopicsReference = toRef(props.state, 'selectedTopics');
const matchAllTopicsReference = toRef(props.state, 'matchAllTopics');

const filteredTopics = ref<string[]>([]);
const allTopics = computed(() => props.context.topics);
filteredTopics.value = allTopics.value;

function filterTopics(value: string, update: (function_: () => void) => void) {
    if (value === '') {
        update(() => {
            filteredTopics.value = allTopics.value;
        });
        return;
    }
    update(() => {
        const needle = value.toLowerCase();
        filteredTopics.value = allTopics.value.filter((v: string) =>
            v.toLowerCase().includes(needle),
        );
    });
}

function setMatchAll() {
    matchAllTopicsReference.value = true;
}
function setMatchAny() {
    matchAllTopicsReference.value = false;
}
function clearTopics() {
    selectedTopicsReference.value = [];
}
</script>
