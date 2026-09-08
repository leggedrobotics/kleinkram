<template>
    <div class="message-viewer q-pa-sm rounded-borders">
        <div class="row justify-between items-center q-mb-sm">
            <div class="text-subtitle2 text-grey-8 flex items-center">
                {{ topicName }}
                <q-badge color="grey-4" text-color="black" class="q-ml-sm">
                    {{ messageType }}
                </q-badge>
            </div>

            <div class="row items-center q-gutter-x-sm">
                <q-badge
                    v-if="(sampleStride ?? 1) > 1"
                    color="grey-3"
                    text-color="grey-9"
                    class="cursor-help"
                >
                    <q-icon name="sym_o_filter_alt" size="xs" class="q-mr-xs" />
                    Sampled: every {{ sampleStride }}th message
                    <q-tooltip>
                        This topic has {{ totalCount }} messages after sampling.
                        Only every {{ sampleStride }}th message is loaded to
                        keep the preview responsive.
                    </q-tooltip>
                </q-badge>
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
        </div>

        <div
            v-if="error"
            class="text-negative q-pa-md bg-red-1 rounded-borders"
        >
            <q-icon name="sym_o_error" /> Failed to load: {{ error }}
        </div>

        <div
            v-else-if="isLoading && !hasData"
            class="column flex-center q-pa-lg text-grey-7 bg-white rounded-borders"
            style="min-height: 200px"
        >
            <q-spinner-dots size="3em" color="primary" />
            <div class="text-subtitle1 q-mt-md">
                Fetching {{ messageType }}...
            </div>
            <div class="text-caption q-mt-xs">
                Loaded {{ messages.length }} / {{ totalCount }} messages
            </div>
        </div>

        <div v-else-if="hasData || isLoading" class="relative-position">
            <q-linear-progress
                v-if="isLoading"
                indeterminate
                color="primary"
                class="absolute-top"
                style="z-index: 1; height: 2px"
            />
            <div
                v-if="renderError"
                class="q-pa-md bg-orange-1 text-orange-10 rounded-borders q-mb-sm row items-center q-gutter-x-sm"
            >
                <q-icon name="sym_o_warning" size="sm" />
                <div class="col">
                    <div class="text-weight-medium">
                        The {{ messageType }} preview failed to render. Showing
                        the raw messages instead.
                    </div>
                    <div class="text-caption ellipsis">{{ renderError }}</div>
                </div>
                <q-btn
                    flat
                    dense
                    no-caps
                    label="Retry"
                    color="orange-10"
                    @click="retryRender"
                />
            </div>
            <component
                :is="renderError ? fallbackComponent : activeComponent"
                :key="renderAttempt"
                :messages="messages"
                :topic-name="topicName"
                :total-count="totalCount"
                :is-loading="isLoading"
                @load-required="loadRequired"
                @load-more="loadMore"
                @pause-preview="emitPausePreview"
            />
        </div>

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
import { computed, onErrorCaptured, ref, watch } from 'vue';
import {
    detectPreviewType,
    getViewerComponent,
    PreviewType,
} from '../../services/message-factory';

const properties = defineProps<{
    topicName: string;
    messageType: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[];
    totalCount: number;
    isLoading: boolean;
    error: string | null;
    protocol?: string;
    topicSize?: number;
    /** Only every n-th message was loaded (1 = all messages) */
    sampleStride?: number;
}>();

const emit = defineEmits(['load-more', 'load-required', 'pause-preview']);

const hasData = computed(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    () => properties.messages && properties.messages.length > 0,
);

// --- Type Detection ---
const currentPreviewType = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-condition
    const sample = properties.messages?.[0]?.data;
    return detectPreviewType(properties.messageType, sample);
});

const activeComponent = computed(() => {
    return getViewerComponent(currentPreviewType.value);
});
const fallbackComponent = getViewerComponent(PreviewType.JSON);

// --- Error Boundary ---
// A viewer that throws while rendering must not take down the whole page.
const renderError = ref<string | null>(null);
const renderAttempt = ref(0);

onErrorCaptured((error) => {
    console.error(`Preview of ${properties.topicName} failed`, error);
    renderError.value = error instanceof Error ? error.message : String(error);
    return false;
});

const retryRender = (): void => {
    renderError.value = null;
    renderAttempt.value++;
};

watch(
    () => properties.topicName,
    () => {
        renderError.value = null;
    },
);

const loadRequired = (): void => {
    emit('load-required');
};

const loadMore = (): void => {
    emit('load-more');
};

const emitPausePreview = (): void => {
    emit('pause-preview');
};
</script>
