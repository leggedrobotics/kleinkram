<template>
    <div class="column q-gutter-y-xs">
        <label class="text-weight-bold">ROS Message Datatypes</label>
        <q-select
            v-model="selectedDatatypes"
            outlined
            dense
            multiple
            color="button-primary"
            options-selected-class="multi-option--selected"
            use-chips
            :options="filteredDatatypes"
            use-input
            clearable
            bg-color="white"
            placeholder="Select datatypes..."
            class="full-width"
            @filter="filterFunction"
            @clear="clearDatatypes"
        >
            <template #option="scope">
                <q-item v-bind="scope.itemProps">
                    <q-item-section side class="multi-option__check">
                        <q-checkbox
                            :model-value="scope.selected"
                            dense
                            size="sm"
                            color="button-primary"
                            tabindex="-1"
                            aria-hidden="true"
                            class="no-pointer-events"
                        />
                    </q-item-section>
                    <q-item-section class="multi-option__label">
                        {{ scope.opt }}
                    </q-item-section>
                </q-item>
            </template>
        </q-select>
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

<style scoped>
.multi-option__check {
    padding-right: 8px;
}

/* the selection shows in the checkbox, the label keeps its colour */
.multi-option__label {
    color: #161616;
}
</style>
