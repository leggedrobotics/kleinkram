<template>
    <div class="recording-facts row bg-white rounded-borders q-mb-lg">
        <div class="recording-facts__item col-12 col-sm-6 col-md">
            <div class="text-placeholder">Written by</div>
            <div class="recording-facts__value ellipsis">
                {{ insights.library || 'unknown' }}
                <q-tooltip v-if="insights.library">
                    {{ insights.library }}
                </q-tooltip>
            </div>
            <div class="text-caption text-grey-7">
                profile {{ insights.profile || 'not set' }}
            </div>
        </div>

        <div class="recording-facts__item col-12 col-sm-6 col-md">
            <div class="text-placeholder">Chunks</div>
            <div class="recording-facts__value">
                {{ insights.storage.chunkCount }} · {{ compression }}
            </div>
            <div class="text-caption text-grey-7">{{ chunkDetail }}</div>
        </div>

        <div class="recording-facts__item col-12 col-sm-6 col-md">
            <div class="text-placeholder">Partial download</div>
            <div
                class="recording-facts__value"
                :class="
                    insights.storage.perMessageAccess
                        ? 'text-positive'
                        : 'text-warning-dark'
                "
            >
                <q-icon
                    :name="
                        insights.storage.perMessageAccess
                            ? 'sym_o_check_circle'
                            : 'sym_o_info'
                    "
                    size="18px"
                />
                {{
                    insights.storage.perMessageAccess
                        ? 'Topic and time filters'
                        : 'Time filter only'
                }}
                <q-tooltip max-width="320px">
                    {{
                        insights.storage.perMessageAccess
                            ? 'Chunks are uncompressed and indexed, so klein download can fetch single messages. Both --topics and a time window cut the transfer.'
                            : 'Chunks are compressed or unindexed, so klein download fetches them whole. Only a time window cuts the transfer.'
                    }}
                </q-tooltip>
            </div>
            <div class="text-caption text-grey-7">
                {{
                    insights.storage.perMessageAccess
                        ? 'both cut the transfer'
                        : 'chunks are fetched whole'
                }}
            </div>
        </div>

        <div
            v-if="insights.coverage"
            class="recording-facts__item col-12 col-sm-6 col-md"
        >
            <div class="text-placeholder">Recording pauses</div>
            <div
                class="recording-facts__value"
                :class="{ 'text-warning-dark': pauses.length > 0 }"
            >
                <template v-if="longestPause">
                    <q-icon name="sym_o_warning" size="18px" />
                    {{ pauses.length }} · about
                    {{ formatSpan(longestPause.end - longestPause.start) }}
                    <q-tooltip max-width="320px">
                        One chunk spans far more time than the others, so the
                        recorder wrote little or nothing during it. The pause
                        lies somewhere inside that chunk.
                    </q-tooltip>
                </template>
                <template v-else>None found</template>
            </div>
            <div class="text-caption text-grey-7">
                {{
                    longestPause
                        ? `around ${clockTime(insights.coverage.startTime, longestPause.start)}, all topics`
                        : 'at chunk resolution'
                }}
            </div>
        </div>

        <div class="recording-facts__item col-12 col-sm-6 col-md">
            <div class="text-placeholder">Embedded</div>
            <div class="recording-facts__value">
                {{ plural(insights.attachments.length, 'attachment') }} ·
                {{ insights.metadataNames.length }} metadata
            </div>
            <div class="text-caption text-grey-7">
                {{ embeddedHint }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { RecordingInsights } from 'src/services/decoding-strategies/recording-insights';
import {
    clockTime,
    formatSpan,
} from 'src/services/decoding-strategies/recording-insights';
import { formatSize } from 'src/services/general-formatting';
import { computed } from 'vue';

const properties = defineProps<{ insights: RecordingInsights }>();

const plural = (count: number, noun: string): string =>
    `${count.toString()} ${noun}${count === 1 ? '' : 's'}`;

const compression = computed(() =>
    properties.insights.storage.compressions
        .map((name) => (name === 'none' ? 'uncompressed' : name))
        .join(', '),
);

const chunkDetail = computed(() => {
    const { compressedSize, uncompressedSize } = properties.insights.storage;
    if (compressedSize > 0 && compressedSize < uncompressedSize) {
        return `${formatSize(compressedSize)}, ${(
            uncompressedSize / compressedSize
        ).toFixed(1)}x`;
    }
    return formatSize(uncompressedSize);
});

const pauses = computed(() => properties.insights.coverage?.pauses ?? []);
const longestPause = computed(
    () =>
        pauses.value.toSorted((a, b) => b.end - b.start - (a.end - a.start))[0],
);

const embeddedHint = computed(() => {
    const { attachments, metadataNames } = properties.insights;
    return attachments.length + metadataNames.length > 0
        ? 'see the tabs above'
        : 'nothing embedded';
});
</script>

<style scoped>
.recording-facts {
    border: 1px solid #e0e0e0;
}

.recording-facts__item {
    padding: 12px 16px;
    min-width: 0;
    border-right: 1px solid #e0e0e0;
}

.recording-facts__item:last-child {
    border-right: 0;
}

.recording-facts__value {
    font-size: 14.5px;
    font-weight: 500;
}

.text-placeholder {
    font-size: 12px;
    color: #666;
}

.text-warning-dark {
    color: #b45309;
}

@media (max-width: 1023px) {
    .recording-facts__item {
        border-right: 0;
        border-bottom: 1px solid #e0e0e0;
    }

    .recording-facts__item:last-child {
        border-bottom: 0;
    }
}
</style>
