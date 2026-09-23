<template>
    <q-badge
        :color="isArtifactUploading ? 'transparent' : badge.color"
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
        <q-tooltip
            v-else-if="action.severity === ActionSeverity.WARNING"
            anchor="top middle"
            self="bottom middle"
        >
            The action completed and reported warnings
        </q-tooltip>
        {{ badge.label }}
    </q-badge>
</template>
<script setup lang="ts">
import { ActionSeverity, ArtifactState } from '@kleinkram/shared';
import { getActionBadge } from 'src/services/generic';
import { computed } from 'vue';

import type { ActionDto } from '@kleinkram/api-dto/types/actions/action.dto';

const properties = defineProps<{ action: ActionDto }>();

const isArtifactUploading = computed(
    () =>
        ArtifactState.AWAITING_ACTION < properties.action.artifacts &&
        properties.action.artifacts < ArtifactState.UPLOADED,
);

const badge = computed(() =>
    getActionBadge(properties.action.state, properties.action.severity, {
        diagnosticCount: properties.action.diagnosticCount,
        failureOrigin: properties.action.failureOrigin,
    }),
);
</script>
<style scoped></style>
