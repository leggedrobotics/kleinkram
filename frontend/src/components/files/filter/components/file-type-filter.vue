<template>
    <div class="column q-gutter-y-xs">
        <label class="text-weight-bold">File Type</label>
        <FileTypeSelector
            v-model="fileTypeFilterReference"
            class="full-width"
        />
    </div>
</template>

<script setup lang="ts">
import FileTypeSelector from 'src/components/file-type-selector.vue';
import { FilterState } from 'src/composables/use-file-filter';
import { FileSearchContextData } from 'src/composables/use-file-search';
import { PropType, toRef } from 'vue';

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

const fileTypeFilterReference = toRef(props.state, 'fileTypeFilter');
</script>
