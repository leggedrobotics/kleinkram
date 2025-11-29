<template>
    <span class="text-grey-6 text-caption q-ml-xs">
        <template v-if="event.action && !hideActionAttribution">
            by Action: {{ event.action.name }}
            <router-link
                :to="{
                    name: 'AnalysisDetailsPage',
                    params: {
                        id: event.action.uuid,
                    },
                }"
                class="text-primary hover-underline"
                style="text-decoration: none"
                @click.stop
            >
                <q-icon name="sym_o_open_in_new" size="xs" />
            </router-link>
            <span v-if="event.action.creator">
                (started by {{ event.action.creator.name }})
            </span>
        </template>
        <template v-else-if="event.type === FileEventType.TOPICS_EXTRACTED">
            automatically triggered on File upload
        </template>
        <template v-else-if="!event.action">
            {{ event.actor?.name ?? 'System' }}
        </template>
    </span>
</template>

<script setup lang="ts">
import { FileEventDto } from '@api/types/file/file-event.dto';
import { FileEventType } from '@common/enum';

defineProps<{
    event: FileEventDto;
    hideActionAttribution?: boolean;
}>();
</script>
