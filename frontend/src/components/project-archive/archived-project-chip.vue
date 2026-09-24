<template>
    <q-chip
        dense
        size="sm"
        :color="transitional ? 'orange-1' : 'blue-grey-1'"
        :text-color="transitional ? 'orange-10' : 'blue-grey-9'"
        :icon="transitional ? 'sym_o_sync' : 'sym_o_inventory_2'"
        class="text-weight-medium q-px-sm archived-project-chip"
    >
        {{ label }}
        <q-tooltip>{{ tooltip }}</q-tooltip>
    </q-chip>
</template>

<script setup lang="ts">
import { ProjectArchiveState } from '@kleinkram/shared';
import { computed } from 'vue';

const { state } = defineProps<{ state: ProjectArchiveState }>();

const transitional = computed(
    () =>
        state === ProjectArchiveState.ARCHIVING ||
        state === ProjectArchiveState.RESTORING,
);

const label = computed(() => {
    switch (state) {
        case ProjectArchiveState.ARCHIVING: {
            return 'Archiving';
        }
        case ProjectArchiveState.RESTORING: {
            return 'Restoring';
        }
        default: {
            return 'Archived';
        }
    }
});

const tooltip = computed(() =>
    state === ProjectArchiveState.ARCHIVED
        ? 'The files are on the archive storage; metadata stays browsable'
        : `The project is read-only while ${label.value.toLowerCase()} runs`,
);
</script>

<style scoped>
.archived-project-chip {
    vertical-align: middle;
}
</style>
