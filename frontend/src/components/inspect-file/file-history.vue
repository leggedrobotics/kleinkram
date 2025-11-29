<template>
    <div class="text-grey-8 q-mt-lg">
        <h2 class="text-h5 q-mb-sm text-grey-9">File Events</h2>
        <div v-if="events?.count && events.count > 0">
            <q-list bordered separator dense class="rounded-borders">
                <template v-for="event in groupedEvents" :key="event.uuid">
                    <!-- Grouped Event (Expandable) -->
                    <FileEventGroupItem
                        v-if="
                            event.events.length > 1 ||
                            event.type === FileEventType.RENAMED
                        "
                        :event="event"
                        :hide-action-attribution="
                            hideActionAttribution ?? false
                        "
                    />

                    <!-- Single Event -->
                    <FileEventSingleItem
                        v-else
                        :event="event"
                        :hide-action-attribution="
                            hideActionAttribution ?? false
                        "
                    />
                </template>
            </q-list>
        </div>
        <div
            v-else
            class="text-italic text-grey-6 q-pa-sm border-dashed text-center"
        >
            No file history available.
        </div>
    </div>
</template>

<script setup lang="ts">
import { FileEventsDto } from '@api/types/file/file-event.dto';
import { FileEventType } from '@common/enum';
import { computed } from 'vue';
import FileEventGroupItem from './file-history/file-event-group-item.vue';
import FileEventSingleItem from './file-history/file-event-single-item.vue';
import { GroupedFileEvent } from './file-history/types';

const props = defineProps<{
    events: FileEventsDto;
    hideActionAttribution?: boolean;
}>();

const groupedEvents = computed<GroupedFileEvent[]>(() => {
    if (!props.events?.data) return [];
    const grouped: GroupedFileEvent[] = [];
    for (const event of props.events.data) {
        const last = grouped.at(-1);

        const isSameEvent =
            last &&
            last.type === event.type &&
            last.actor?.uuid === event.actor?.uuid &&
            last.action?.name === event.action?.name &&
            last.file?.uuid === event.file?.uuid;

        const isUploadSequence =
            last &&
            last.type === FileEventType.UPLOAD_COMPLETED &&
            event.type === FileEventType.UPLOAD_STARTED &&
            last.actor?.uuid === event.actor?.uuid &&
            last.file?.uuid === event.file?.uuid;

        if (isSameEvent) {
            last.count++;
            last.events.push(event);
        } else if (isUploadSequence) {
            last.events.push(event);
            last.isUploadGroup = true;
        } else {
            grouped.push({ ...event, count: 1, events: [event] });
        }
    }
    return grouped;
});
</script>
