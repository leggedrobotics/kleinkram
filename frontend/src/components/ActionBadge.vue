<template>
    <q-badge
        :color="
            action.artifact_uploading
                ? 'transparent'
                : getActionColor(action.state)
        "
        :style="action.artifact_uploading ? 'color: #000;' : ''"
        class="q-pa-sm button-border"
    >
        <q-tooltip
            v-if="action.artifact_uploading"
            anchor="top middle"
            self="bottom middle"
        >
            Artifact upload in progress
        </q-tooltip>
        {{ action.state }}
    </q-badge>
</template>
<script setup lang="ts">
import { Action } from 'src/types/Action';

const props = defineProps<{
    action: Action;
}>();
import { getActionColor } from 'src/services/generic';
</script>
<style scoped></style>
