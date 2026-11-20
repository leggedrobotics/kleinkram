<template>
    <div class="coverage">
        <div class="coverage__track">
            <div
                v-for="(cell, index) in cells"
                :key="index"
                class="coverage__cell"
                :class="{
                    'coverage__cell--covered': cell.covered,
                    'coverage__cell--pause': cell.pause,
                }"
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
import type { FileTopicStats, TimeSpan } from '@kleinkram/shared';
import {
    clockTime,
    formatSpan,
} from 'src/services/decoding-strategies/recording-insights';
import { computed } from 'vue';

const properties = defineProps<{
    stats: FileTopicStats;
    topic: string;
}>();

/** Every strip has the same number of cells, so the columns line up. */
const CELLS = 20;

const topicStats = computed(() => properties.stats.topics[properties.topic]);
const covered = computed(() => topicStats.value?.covered ?? []);
const gaps = computed(() => topicStats.value?.gaps ?? []);
const pauses = computed(() => properties.stats.pauses);

/**
 * Whether `span` touches the cell `[start, end)`. A latched topic is a span
 * of almost no width at the very start, and still marks its cell.
 */
const touches = (span: TimeSpan, start: number, end: number): boolean =>
    span.end > span.start
        ? span.start < end && span.end > start
        : span.start >= start && span.start < end;

const cells = computed(() => {
    const width = properties.stats.durationSeconds / CELLS;
    return Array.from({ length: CELLS }, (_, index) => {
        const start = index * width;
        // The last cell closes the recording, so its end is inclusive.
        const end = index === CELLS - 1 ? Infinity : start + width;
        return {
            covered: covered.value.some((span) => touches(span, start, end)),
            pause: pauses.value.some((span) => touches(span, start, end)),
        };
    });
});

const at = (offset: number): string =>
    clockTime(properties.stats.startTime, offset);

const describe = (span: TimeSpan): string =>
    `${formatSpan(span.end - span.start)} missing at ${at(span.start)}`;

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
    const lines: string[] = [];
    if (topicStats.value) {
        lines.push(
            `First seen ${at(topicStats.value.firstSeen)}, last seen ${at(
                topicStats.value.lastSeen,
            )}`,
        );
    }
    lines.push(
        ...gaps.value
            .slice(0, MAX_TOOLTIP_LINES)
            .map((gap) =>
                isIntermittent.value
                    ? `No messages for ${formatSpan(gap.end - gap.start)} at ${at(gap.start)}`
                    : describe(gap),
            ),
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
            )} around ${at(pause.start)}`,
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
    display: grid;
    grid-template-columns: repeat(20, 1fr);
    gap: 1px;
    height: 12px;
}

.coverage__cell {
    background: #e8e8e8;
}

.coverage__cell:first-child {
    border-radius: 2px 0 0 2px;
}

.coverage__cell:last-child {
    border-radius: 0 2px 2px 0;
}

.coverage__cell--covered {
    background: #3d70b2;
}

/* The recording paused in this slice: the topic's chunk may exist, but
   holds a stretch without data from any topic. */
.coverage__cell--pause {
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
