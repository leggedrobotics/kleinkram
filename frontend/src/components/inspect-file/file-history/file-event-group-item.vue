<template>
    <q-expansion-item group="file-events" dense class="q-py-none">
        <template #header>
            <q-item-section avatar>
                <FileEventIcon :type="event.type" />
            </q-item-section>

            <q-item-section>
                <q-item-label>
                    {{
                        event.isUploadGroup
                            ? 'Upload'
                            : formatEventType(event.type)
                    }}
                    <q-badge
                        v-if="event.count > 1"
                        color="grey-4"
                        text-color="black"
                        class="q-ml-xs"
                        :label="`x${event.count}`"
                    />
                    <span class="text-grey-6 text-caption q-ml-xs">
                        <template v-if="event.action && !hideActionAttribution">
                            by Action: {{ event.action.name }}
                            <span v-if="event.action.creator">
                                (started by {{ event.action.creator.name }})
                            </span>
                        </template>
                        <template
                            v-else-if="
                                event.type === FileEventType.TOPICS_EXTRACTED
                            "
                        >
                            automatically triggered on File upload
                        </template>
                        <template v-else-if="!event.action">
                            {{ event.actor?.name ?? 'System' }}
                        </template>
                    </span>
                    <FileEventFileInfo :file="event.file" />
                </q-item-label>
            </q-item-section>

            <q-item-section side>
                <div class="text-caption text-grey-6">
                    {{ formatDate(event.createdAt) }}
                </div>
            </q-item-section>
        </template>

        <q-card>
            <q-card-section class="q-pa-none">
                <q-list dense separator>
                    <q-item
                        v-for="subEvent in event.events"
                        :key="subEvent.uuid"
                        class="q-pl-xl"
                    >
                        <q-item-section>
                            <q-item-label class="text-caption text-grey-7">
                                {{ formatEventType(subEvent.type) }}
                                <FileEventAttribution
                                    :event="subEvent"
                                    :hide-action-attribution="
                                        hideActionAttribution ?? false
                                    "
                                />
                            </q-item-label>
                            <q-item-label
                                v-if="subEvent.details?.generatedFilename"
                                caption
                            >
                                &rarr;
                                {{ subEvent.details.generatedFilename }}
                            </q-item-label>
                            <q-item-label
                                v-if="subEvent.details?.sourceFilename"
                                caption
                            >
                                &larr;
                                {{ subEvent.details.sourceFilename }}
                            </q-item-label>
                            <q-item-label
                                v-if="subEvent.details?.source"
                                caption
                            >
                                via
                                {{ subEvent.details.source }}
                            </q-item-label>
                            <q-item-label
                                v-if="
                                    subEvent.details?.oldFilename &&
                                    subEvent.details?.newFilename
                                "
                                caption
                            >
                                {{ subEvent.details.oldFilename }}
                                &rarr;
                                {{ subEvent.details.newFilename }}
                            </q-item-label>
                        </q-item-section>
                        <q-item-section side>
                            <div class="text-caption text-grey-6">
                                {{ formatDate(subEvent.createdAt) }}
                            </div>
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-card-section>
        </q-card>
    </q-expansion-item>
</template>

<script setup lang="ts">
import { FileEventType } from '@kleinkram/shared';
import { formatDate } from 'src/services/date-formating';
import FileEventAttribution from './file-event-attribution.vue';
import FileEventFileInfo from './file-event-file-info.vue';
import FileEventIcon from './file-event-icon.vue';
import { GroupedFileEvent } from './types';
import { formatEventType } from './utilities';

defineProps<{
    event: GroupedFileEvent;
    hideActionAttribution?: boolean;
}>();
</script>
