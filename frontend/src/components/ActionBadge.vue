<template>
    <q-badge
        :color="
            isArtifactUploading ? 'transparent' : getActionColor(action.state)
        "
        :style="isArtifactUploading ? 'color: #000;' : ''"
        class="q-pa-sm button-border"
    >
        <q-tooltip
            v-if="isArtifactUploading"
            anchor="top middle"
            self="bottom middle"
        >
            Artifact upload in progress
        </q-tooltip>
        {{ action.state }}
    </q-badge>
</template>
<script setup lang="ts">
import { getActionColor } from 'src/services/generic';
import { computed } from 'vue';
import { ArtifactState } from '@common/enum';

const props = defineProps<{
    action: Action;
}>();

const isArtifactUploading = computed(
    () =>
        ArtifactState.AWAITING_ACTION < props.action.artifacts &&
        props.action.artifacts < ArtifactState.UPLOADED,
);
</script>
<style scoped></style>
