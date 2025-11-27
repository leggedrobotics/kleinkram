<template>
    <div class="message-viewer bg-grey-1 q-pa-sm rounded-borders">
        <div class="row justify-between items-center q-mb-sm">
            <div class="text-subtitle2 text-grey-8 flex items-center">
                {{ topicName }}
                <q-badge color="grey-4" text-color="black" class="q-ml-sm">
                    {{ messageType }}
                </q-badge>
            </div>

            <q-badge
                color="orange-7"
                text-color="white"
                label="BETA"
                class="text-weight-bold cursor-help"
                style="font-size: 10px; padding: 2px 6px"
            >
                <q-tooltip>
                    Preview functionality is currently in beta.
                </q-tooltip>
            </q-badge>
        </div>

        <div
            v-if="error"
            class="text-negative q-pa-md bg-red-1 rounded-borders"
        >
            <q-icon name="sym_o_error" /> Failed to load: {{ error }}
        </div>

        <div
            v-else-if="isLoading && !hasData"
            class="row items-center q-pa-md text-grey-7"
        >
            <q-spinner-dots size="1.5em" />
            <span class="q-ml-sm">Fetching data...</span>
        </div>

        <component
            :is="activeComponent"
            v-else-if="hasData || isLoading"
            :messages="messages"
            :topic-name="topicName"
            :total-count="totalCount"
            @load-required="loadRequired"
            @load-more="loadMore"
        />

        <div
            v-else
            class="text-italic text-grey q-pa-md text-center cursor-pointer"
            @click="loadRequired"
        >
            <q-btn
                label="Load Messages"
                icon="sym_o_download"
                flat
                dense
                color="primary"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
    detectPreviewType,
    getViewerComponent,
} from '../../services/message-factory';

const properties = defineProps<{
    topicName: string;
    messageType: string;
    messages: any[];
    totalCount: number;
    isLoading: boolean;
    error: string | null;
    protocol?: string;
    topicSize?: number;
}>();

const emit = defineEmits(['load-more', 'load-required']);

const hasData = computed(
    () => properties.messages && properties.messages.length > 0,
);

// --- Type Detection ---
const currentPreviewType = computed(() => {
    const sample = properties.messages?.[0]?.data;
    return detectPreviewType(properties.messageType, sample);
});

const activeComponent = computed(() => {
    return getViewerComponent(currentPreviewType.value);
});

const loadRequired = (): void => {
    emit('load-required');
};

const loadMore = (): void => {
    emit('load-more');
};
</script>
