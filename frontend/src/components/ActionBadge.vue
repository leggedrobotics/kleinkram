<template>
    <q-badge
        :color="
            is_artifact_uploading ? 'transparent' : getActionColor(action.state)
        "
        :style="is_artifact_uploading ? 'color: #000;' : ''"
        class="q-pa-sm button-border"
    >
        <q-tooltip
            v-if="is_artifact_uploading"
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
import { getActionColor } from 'src/services/generic';
import { computed } from 'vue';

const props = defineProps<{
    action: Action;
}>();

const is_artifact_uploading = computed(
    () => 10 < props.action.artifacts && props.action.artifacts < 30,
);
</script>
<style scoped></style>
