<template>
    <div class="column q-gutter-y-xs">
        <label class="text-weight-bold">Mission Metadata</label>
        <!-- eslint-disable-next-line vue/no-mutating-props -->
        <MetadataFilterBuilder v-model="state.tagFilter" />
    </div>
</template>

<script setup lang="ts">
import MetadataFilterBuilder from 'src/components/files/filter/metadata-filter-builder.vue';
import { FilterState } from 'src/composables/use-file-filter';
import { FileSearchContextData } from 'src/composables/use-file-search';
import { PropType } from 'vue';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
</script>
