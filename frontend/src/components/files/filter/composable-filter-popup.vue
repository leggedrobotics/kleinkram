<template>
    <div class="column q-gutter-y-md" style="min-width: 300px; padding: 16px">
        <div class="text-h6">Advanced Filters</div>

        <!-- Render each filter's advanced component -->
        <template v-for="filter in filters" :key="filter.key">
            <component
                :is="filter.advancedComponent"
                v-if="filter.advancedComponent"
                :state="state"
                :context="context"
                @update-project="onUpdateProject"
                @update-mission="onUpdateMission"
            />
        </template>

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
import { FilterState } from 'src/composables/use-file-filter';
import { Filter } from 'src/services/filters/filter-interface';
import { PropType } from 'vue';

defineProps({
    filters: {
        type: Array as PropType<Filter<FilterState, unknown>[]>,
        required: true,
    },
    state: {
        type: Object as PropType<FilterState>,
        required: true,
    },
    context: {
        type: Object,
        required: true,
    },
});

const emit = defineEmits(['update-project', 'update-mission', 'reset']);

function onUpdateProject(uuid: string | null) {
    emit('update-project', uuid);
}

function onUpdateMission(uuid: string | null) {
    emit('update-mission', uuid);
}

function onReset() {
    emit('reset');
}
</script>
