<template>
    <div class="column q-gutter-y-xs">
        <label class="text-weight-bold">ROS Message Datatypes</label>
        <q-select
            v-model="selectedDatatypes"
            outlined
            dense
            multiple
            use-chips
            :options="filteredDatatypes"
            use-input
            clearable
            bg-color="white"
            placeholder="Select datatypes..."
            class="full-width"
            @filter="filterFunction"
            @clear="clearDatatypes"
        />
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

const selectedDatatypes = toRef(props.state, 'selectedDatatypes');
const filteredDatatypes = ref<string[]>([]);
const all = computed(() => props.context.datatypes);
filteredDatatypes.value = all.value;

function filterFunction(
    value: string,
    update: (function_: () => void) => void,
) {
    if (value === '') {
        update(() => {
            filteredDatatypes.value = all.value;
        });
        return;
    }
    update(() => {
        const needle = value.toLowerCase();
        filteredDatatypes.value = all.value.filter((v: string) =>
            v.toLowerCase().includes(needle),
        );
    });
}

function clearDatatypes() {
    selectedDatatypes.value = [];
}
</script>
