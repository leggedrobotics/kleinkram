<template>
    <div class="coverage">
        <div class="coverage__track">
            <div
                v-for="(span, index) in covered"
                :key="`c${String(index)}`"
                class="coverage__covered"
                :style="position(span)"
            />
            <div
                v-for="(span, index) in pauses"
                :key="`p${String(index)}`"
                class="coverage__pause"
                :style="position(span)"
            />
            <q-tooltip v-if="tooltip.length > 0" anchor="top middle">
                <div v-for="line in tooltip" :key="line">{{ line }}</div>
            </q-tooltip>
        </div>
        <div
            v-if="note"
            class="coverage__note"
            :class="isIntermittent ? 'text-grey-7' : 'text-warning-dark'"
        >
            <q-icon v-if="!isIntermittent" name="sym_o_warning" size="14px" />
            {{ note }}
        </div>
    </div>
</template>

<script setup lang="ts">
import type { RecordingCoverage, TimeSpan } from '@kleinkram/shared';
import {
    clockTime,
    formatSpan,
} from 'src/services/decoding-strategies/recording-insights';
import { computed } from 'vue';

const properties = defineProps<{
    coverage: RecordingCoverage;
    topic: string;
}>();

const topicCoverage = computed(
    () => properties.coverage.topics[properties.topic],
);
const covered = computed(() => topicCoverage.value?.covered ?? []);
const gaps = computed(() => topicCoverage.value?.gaps ?? []);
const pauses = computed(() => properties.coverage.pauses);

/**
 * A span narrower than a pixel disappears, and a latched topic is exactly
 * that: one message at the very start. Every span gets a minimum width.
 */
const position = (span: TimeSpan): Record<string, string> => {
    const duration = properties.coverage.durationSeconds;
    const left = (span.start / duration) * 100;
    const width = ((span.end - span.start) / duration) * 100;
    return {
        left: `${left.toFixed(3)}%`,
        width: `max(${width.toFixed(3)}%, 2px)`,
    };
};

const describe = (span: TimeSpan): string =>
    `${formatSpan(span.end - span.start)} missing at ${clockTime(
        properties.coverage.startTime,
        span.start,
    )}`;

/**
 * A stream that drops out once or twice has a fault worth pointing at. A topic
 * with many holes is event driven (`/parameter_events`, say): it publishes
 * when something happens, and calling every silence "missing" would be wrong.
 */
const MAX_DROPOUTS = 3;
const MAX_TOOLTIP_LINES = 8;

const isIntermittent = computed(() => gaps.value.length > MAX_DROPOUTS);

const longestGap = computed(
    () => gaps.value.toSorted((a, b) => b.end - b.start - (a.end - a.start))[0],
);

const note = computed(() => {
    const longest = longestGap.value;
    if (!longest) return '';
    if (isIntermittent.value) {
        return `intermittent, longest gap ${formatSpan(longest.end - longest.start)}`;
    }
    const more = gaps.value.length - 1;
    return more > 0
        ? `${describe(longest)}, ${more.toString()} more`
        : describe(longest);
});

const tooltip = computed(() => {
    const lines = gaps.value
        .slice(0, MAX_TOOLTIP_LINES)
        .map((gap) =>
            isIntermittent.value
                ? `No messages for ${formatSpan(gap.end - gap.start)} at ${clockTime(properties.coverage.startTime, gap.start)}`
                : describe(gap),
        );
    if (gaps.value.length > MAX_TOOLTIP_LINES) {
        lines.push(
            `and ${(gaps.value.length - MAX_TOOLTIP_LINES).toString()} more`,
        );
    }
    for (const pause of pauses.value) {
        lines.push(
            `Recording paused for about ${formatSpan(
                pause.end - pause.start,
            )} around ${clockTime(properties.coverage.startTime, pause.start)}`,
        );
    }
    return lines;
});
</script>

<style scoped>
/* The note sits under the track, not beside it: every strip in the table
   then has the same width and the same time axis. */
.coverage {
    min-width: 120px;
}

.coverage__track {
    position: relative;
    height: 12px;
    border-radius: 2px;
    background: #e8e8e8;
    overflow: hidden;
}

.coverage__covered,
.coverage__pause {
    position: absolute;
    top: 0;
    bottom: 0;
}

.coverage__covered {
    background: #3d70b2;
}

/* Drawn over the covered span: the chunk exists, but holds a pause */
.coverage__pause {
    background: repeating-linear-gradient(
        45deg,
        #fff3e0,
        #fff3e0 2px,
        #f1a04b 2px,
        #f1a04b 4px
    );
}

.coverage__note {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.3;
    white-space: nowrap;
}

.text-warning-dark {
    color: #b45309;
}
</style>
