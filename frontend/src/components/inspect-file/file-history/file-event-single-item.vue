<template>
    <q-item class="q-py-sm" clickable>
        <FileEventIcon :type="event.type" />
        <q-item-section>
            <q-item-label>
                {{ formatEventType(event.type) }}
                <FileEventAttribution
                    :event="event"
                    :hide-action-attribution="hideActionAttribution ?? false"
                />
                <FileEventFileInfo :file="event.file" />
            </q-item-label>
            <q-item-label v-if="event.details?.generatedFilename" caption>
                &rarr; {{ event.details.generatedFilename }}
            </q-item-label>
            <q-item-label v-if="event.details?.sourceFilename" caption>
                &larr; {{ event.details.sourceFilename }}
            </q-item-label>
        </q-item-section>
        <q-item-section side style="padding-right: 40px">
            <div class="text-caption text-grey-6">
                {{ formatDate(event.createdAt) }}
            </div>
        </q-item-section>
    </q-item>
</template>

<script setup lang="ts">
import { FileEventDto } from '@kleinkram/api-dto/types/file/file-event.dto';
import { formatDate } from 'src/services/date-formating';
import FileEventAttribution from './file-event-attribution.vue';
import FileEventFileInfo from './file-event-file-info.vue';
import FileEventIcon from './file-event-icon.vue';
import { formatEventType } from './utilities';

defineProps<{
    event: FileEventDto;
    hideActionAttribution?: boolean;
}>();
</script>
