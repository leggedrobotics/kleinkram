<template>
    <div class="text-grey-8 q-mt-lg">
        <h2 class="text-h5 q-mb-sm text-grey-9">File Events</h2>
        <div v-if="events?.count && events.count > 0">
            <q-list bordered separator dense class="rounded-borders">
                <q-item
                    v-for="event in events.data"
                    :key="event.uuid"
                    class="q-py-sm"
                    clickable
                >
                    <q-item-section
                        avatar
                        class="q-pr-none"
                        style="min-width: 30px"
                    >
                        <q-icon
                            :name="getEventIcon(event.type)"
                            size="xs"
                            :color="getEventColor(event.type)"
                        />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label>
                            {{ formatEventType(event.type) }}
                            <span class="text-grey-6 text-caption q-ml-xs">
                                {{ event.actor?.name ?? 'System' }}
                            </span>
                        </q-item-label>
                        <q-item-label
                            v-if="event.details?.generatedFilename"
                            caption
                        >
                            &rarr; {{ event.details.generatedFilename }}
                        </q-item-label>
                        <q-item-label
                            v-if="event.details?.sourceFilename"
                            caption
                        >
                            &larr; {{ event.details.sourceFilename }}
                        </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <div class="text-caption text-grey-6">
                            {{ formatDate(event.createdAt) }}
                        </div>
                    </q-item-section>
                </q-item>
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
import { formatDate } from 'src/services/date-formating';

defineProps<{ events: FileEventsDto }>();

function formatEventType(type: FileEventType): string {
    const map: Record<string, string> = {
        [FileEventType.CREATED]: 'File Created',
        [FileEventType.UPLOAD_STARTED]: 'Upload Started',
        [FileEventType.UPLOAD_COMPLETED]: 'Upload Completed',
        [FileEventType.DOWNLOADED]: 'Downloaded',
        [FileEventType.FOXGLOVE_URL_GENERATED]: 'Foxglove URL Generated',
        [FileEventType.RENAMED]: 'Renamed',
        [FileEventType.MOVED]: 'Moved',
        [FileEventType.TOPICS_EXTRACTED]: 'Topics Extracted',
        [FileEventType.FILE_CONVERTED]: 'Auto Converted To',
        [FileEventType.FILE_CONVERTED_FROM]: 'Auto Converted From',
    };
    return map[type] ?? type;
}

function getEventIcon(type: FileEventType): string {
    if (type.includes('FAILED') || type.includes('ERROR')) return 'sym_o_error';
    if (type.includes('COMPLETED') || type.includes('CREATED'))
        return 'sym_o_check_circle';
    if (type.includes('DOWNLOAD')) return 'sym_o_download';
    if (type.includes(FileEventType.FOXGLOVE_URL_GENERATED))
        return 'sym_o_dataset_linked';
    if (type.includes('UPLOAD')) return 'sym_o_upload';
    if (type.includes('DELETE')) return 'sym_o_delete';
    if (type === FileEventType.TOPICS_EXTRACTED) return 'sym_o_topic';
    if (type === FileEventType.FILE_CONVERTED) return 'sym_o_transform';
    if (type === FileEventType.FILE_CONVERTED_FROM) return 'sym_o_input';

    return 'sym_o_history';
}

function getEventColor(type: string): string {
    if (type.includes('FAILED') || type.includes('ERROR')) return 'negative';
    if (type.includes(FileEventType.FOXGLOVE_URL_GENERATED)) return 'secondary';
    if (type.includes('COMPLETED') || type.includes('CREATED'))
        return 'positive';
    if (type.includes('DELETE')) return 'grey-6';
    if ((type as FileEventType) === FileEventType.TOPICS_EXTRACTED)
        return 'info';
    if (type.includes('CONVERTED')) return 'accent';

    return 'primary';
}
</script>
