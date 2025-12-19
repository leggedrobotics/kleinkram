<template>
    <ScopeSelector
        layout="column"
        :show-labels="true"
        :project-uuid="context.projectUuid"
        :mission-uuid="context.missionUuid"
        :custom-projects="context.projects as any"
        @update:project-uuid="onUpdateProject"
        @update:mission-uuid="onUpdateMission"
    />
</template>

<script setup lang="ts">
import ScopeSelector from 'src/components/common/scope-selector.vue';
import { FilterState } from 'src/composables/use-file-filter';
import { FileSearchContextData } from 'src/composables/use-file-search';
import { PropType } from 'vue';

defineProps({
    state: {
        type: Object as PropType<FilterState>,
        required: true,
    },
    context: {
        type: Object as PropType<FileSearchContextData>,
        required: true,
    },
});

const emit = defineEmits(['update-project', 'update-mission']);

function onUpdateProject(uuid: string | undefined) {
    emit('update-project', uuid);
}

function onUpdateMission(uuid: string | undefined) {
    emit('update-mission', uuid);
}
</script>
