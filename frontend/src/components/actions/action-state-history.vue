<template>
    <div v-if="entries.length > 0">
        <div class="text-h6 q-mb-sm">State History</div>

        <q-timeline layout="dense" class="q-mt-none">
            <q-timeline-entry
                v-for="entry in entries"
                :key="entry.uuid"
                :color="getActionColor(entry.state)"
                :subtitle="formatDate(entry.createdAt)"
            >
                <template #title>
                    <div class="row items-center q-gutter-x-sm">
                        <q-badge
                            :color="getActionColor(entry.state)"
                            :label="entry.state"
                        />
                        <span class="text-body2">{{ entry.cause }}</span>
                    </div>
                </template>
            </q-timeline-entry>
        </q-timeline>
    </div>
</template>

<script setup lang="ts">
import type { ActionStateTransitionDto } from '@kleinkram/api-dto/types/actions/action-state-history.dto';
import { getActionColor } from 'src/services/generic';

defineProps<{ entries: ActionStateTransitionDto[] }>();

const formatDate = (d: string | Date) => new Date(d).toLocaleString();
</script>
