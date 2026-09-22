<template>
    <div class="ros-log-viewer">
        <div class="bg-white rounded-borders border-color">
            <div class="q-pa-md border-bottom column q-gutter-y-sm">
                <div class="row justify-between items-center q-gutter-x-sm">
                    <div class="row items-center q-gutter-x-sm">
                        <q-badge color="blue-grey-1" text-color="blue-grey-9">
                            {{ messages.length }} logs
                        </q-badge>

                        <!-- One chip per severity present in the stream.
                             Clicking a chip filters down to that level, so the
                             three warnings in a thousand info lines are one
                             click away. -->
                        <q-chip
                            v-for="entry in levelSummary"
                            :key="entry.label"
                            dense
                            clickable
                            :outline="level !== entry.label"
                            :color="entry.chipColor"
                            :text-color="
                                level === entry.label
                                    ? 'white'
                                    : entry.chipColor
                            "
                            class="text-weight-medium"
                            @click="() => toggleLevel(entry.label)"
                        >
                            {{ entry.count }} {{ entry.label }}
                            <q-tooltip>
                                {{
                                    level === entry.label
                                        ? 'Show all levels'
                                        : `Show only ${entry.label} messages`
                                }}
                            </q-tooltip>
                        </q-chip>
                    </div>

                    <div class="row items-center q-gutter-x-xs">
                        <q-toggle
                            v-model="showSource"
                            label="Source"
                            color="primary"
                            dense
                            left-label
                        >
                            <q-tooltip>
                                {{
                                    showSource
                                        ? 'The file and function that emitted a line are shown after it'
                                        : 'Show the file and function that emitted each line'
                                }}
                            </q-tooltip>
                        </q-toggle>
                        <q-toggle
                            v-model="wrapLines"
                            label="Wrap lines"
                            color="primary"
                            dense
                            left-label
                        >
                            <q-tooltip>
                                {{
                                    wrapLines
                                        ? 'Long log lines wrap onto the next line'
                                        : 'Long log lines stay on one line, scroll horizontally to read them'
                                }}
                            </q-tooltip>
                        </q-toggle>
                        <q-btn
                            icon="sym_o_content_copy"
                            flat
                            round
                            dense
                            size="sm"
                            color="grey-7"
                            :disable="filteredMessages.length === 0"
                            @click="copyLogs"
                        >
                            <q-tooltip>Copy shown logs</q-tooltip>
                        </q-btn>
                        <q-btn
                            icon="sym_o_download"
                            flat
                            round
                            dense
                            size="sm"
                            color="grey-7"
                            :disable="filteredMessages.length === 0"
                            @click="downloadLogs"
                        >
                            <q-tooltip>Download shown logs</q-tooltip>
                        </q-btn>
                    </div>
                </div>

                <div
                    :class="
                        $q.screen.xs
                            ? 'column q-gutter-y-sm'
                            : 'row q-gutter-x-md items-center'
                    "
                >
                    <app-search-bar
                        v-model="search"
                        placeholder="Search logs..."
                        :style="$q.screen.xs ? undefined : 'width: 240px'"
                    />

                    <q-select
                        v-model="level"
                        :options="levelOptions"
                        dense
                        outlined
                        label="Level"
                        :style="$q.screen.xs ? undefined : 'width: 150px'"
                        emit-value
                        map-options
                    />

                    <q-select
                        v-model="node"
                        :options="nodeOptions"
                        dense
                        outlined
                        label="Node"
                        :style="$q.screen.xs ? undefined : 'width: 220px'"
                        emit-value
                        map-options
                    />

                    <div class="text-caption text-grey-7">
                        Showing {{ filteredMessages.length }} of
                        {{ messages.length }} lines
                        <template v-if="messages.length < totalCount">
                            ({{ totalCount }} in the topic)
                        </template>
                    </div>
                </div>

                <div
                    v-if="isFiltered && messages.length < totalCount"
                    class="text-caption text-orange-9 row items-center q-gutter-x-xs"
                >
                    <q-icon name="sym_o_info" size="xs" />
                    <span>
                        Only the first {{ messages.length }} of
                        {{ totalCount }} messages are loaded; the filter does
                        not cover the rest yet.
                    </span>
                </div>
            </div>

            <div
                v-if="filteredMessages.length === 0"
                class="q-pa-lg text-center text-grey-7"
            >
                <template v-if="messages.length === 0">
                    No log messages.
                </template>
                <template v-else>
                    <div>No log message matches the current filter.</div>
                    <q-btn
                        flat
                        dense
                        no-caps
                        color="primary"
                        label="Clear filters"
                        class="q-mt-sm"
                        @click="clearFilters"
                    />
                </template>
            </div>

            <q-virtual-scroll
                v-else
                ref="logScroll"
                :items="filteredMessages"
                :virtual-scroll-item-size="22"
                class="log-output bg-grey-1 rounded-borders q-pa-sm"
                :class="{ 'log-output--nowrap': !wrapLines }"
                style="max-height: 500px"
            >
                <template #default="{ item, index }">
                    <div :key="index" class="log-line">
                        <span class="log-line__time">{{
                            formatTime(item.logTime)
                        }}</span>
                        <span
                            class="log-line__level"
                            :class="levelClass(item.data.level)"
                            >{{ levelLabel(item.data.level) }}</span
                        >
                        <span class="log-line__node">
                            <span
                                v-for="(part, at) in highlight(item.data.name)"
                                :key="at"
                                :class="{ 'log-line__match': part.match }"
                                >{{ part.text }}</span
                            >
                        </span>
                        <span class="log-line__message">
                            <span
                                v-for="(part, at) in highlight(item.data.msg)"
                                :key="at"
                                :class="{ 'log-line__match': part.match }"
                                >{{ part.text }}</span
                            ><span
                                v-if="showSource && origin(item.data)"
                                class="log-line__source"
                                :title="originPath(item.data)"
                                >{{ origin(item.data) }}</span
                            >
                        </span>
                    </div>
                </template>
            </q-virtual-scroll>

            <div
                v-if="messages.length < totalCount"
                class="text-center q-pa-md bg-grey-1"
            >
                <SmoothLoading
                    :current="messages.length"
                    :total="totalCount"
                    message="Showing {current} / {total} logs."
                />
                <q-btn
                    label="Load More"
                    icon="sym_o_download"
                    size="sm"
                    flat
                    color="primary"
                    @click="loadMore"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import AppSearchBar from 'components/common/app-search-bar.vue';
import {
    Notify,
    QVirtualScroll,
    copyToClipboard as quasarCopy,
    useQuasar,
} from 'quasar';
import { formatDate } from 'src/services/date-formating';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import SmoothLoading from '../../common/smooth-loading.vue';

const $q = useQuasar();

interface RosLogPayload {
    level: number;
    name: string;
    msg: string;
    file?: string;
    function?: string;
    line?: number;
}

interface RosLogMessage {
    logTime: bigint;
    data: RosLogPayload;
}

const properties = defineProps<{
    messages: RosLogMessage[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required', 'load-more']);

onMounted(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!properties.messages || properties.messages.length === 0)
        emit('load-required');
});

// --- Log levels ---
// ROS 1 (rosgraph_msgs/Log) numbers the levels as a bitmask, ROS 2
// (rcl_interfaces/msg/Log) in steps of ten. The two sets do not overlap, so a
// single table decodes both and /rosout of a ROS 2 recording no longer shows
// up as a wall of "UNK".
const LEVEL_BY_VALUE = new Map<number, string>([
    [1, 'DEBUG'],
    [2, 'INFO'],
    [4, 'WARN'],
    [8, 'ERROR'],
    [16, 'FATAL'],
    [10, 'DEBUG'],
    [20, 'INFO'],
    [30, 'WARN'],
    [40, 'ERROR'],
    [50, 'FATAL'],
]);

/** Severities from least to most severe, used to order the filter options. */
const LEVEL_ORDER = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

const UNKNOWN_LEVEL = 'UNK';

const levelLabel = (value: number): string =>
    LEVEL_BY_VALUE.get(value) ?? UNKNOWN_LEVEL;

const LEVEL_TEXT_CLASS: Record<string, string> = {
    DEBUG: 'text-grey-6',
    INFO: 'text-grey-8',
    WARN: 'text-orange-9',
    ERROR: 'text-negative',
    FATAL: 'text-negative',
};

const LEVEL_CHIP_COLOR: Record<string, string> = {
    DEBUG: 'grey-6',
    INFO: 'blue-grey-6',
    WARN: 'orange-9',
    ERROR: 'negative',
    FATAL: 'negative',
};

const levelClass = (value: number): string =>
    LEVEL_TEXT_CLASS[levelLabel(value)] ?? 'text-grey-8';

/**
 * Where the line was logged, short enough to sit at the end of it:
 * `recorder.cpp:195 · record`. ROS 2 records the full build-time path, which
 * is too long for the list, so only the file name is kept here.
 */
const origin = (data: RosLogPayload): string => {
    const file = data.file?.split('/').pop() ?? '';
    const at =
        data.line === undefined || file === ''
            ? file
            : `${file}:${String(data.line)}`;
    return [at, data.function].filter(Boolean).join(' · ');
};

/** The unabbreviated source location, for the annotation's native title. */
const originPath = (data: RosLogPayload): string =>
    [data.file, data.function].filter(Boolean).join(' · ');

// --- Filters ---
const search = ref('');
const level = ref('all');
const node = ref('all');

const isFiltered = computed(
    () => search.value !== '' || level.value !== 'all' || node.value !== 'all',
);

const clearFilters = (): void => {
    search.value = '';
    level.value = 'all';
    node.value = 'all';
};

const toggleLevel = (label: string): void => {
    level.value = level.value === label ? 'all' : label;
};

const levelCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const message of properties.messages) {
        const label = levelLabel(message.data.level);
        counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return counts;
});

const presentLevels = computed(() =>
    [...levelCounts.value.keys()].toSorted((a, b) => {
        // Unknown levels sort last, everything else by severity
        const indexA = LEVEL_ORDER.indexOf(a);
        const indexB = LEVEL_ORDER.indexOf(b);
        return (
            (indexA === -1 ? LEVEL_ORDER.length : indexA) -
            (indexB === -1 ? LEVEL_ORDER.length : indexB)
        );
    }),
);

/** Severity chips, most severe first so warnings and errors lead. */
const levelSummary = computed(() =>
    presentLevels.value.toReversed().map((label) => ({
        label,
        count: levelCounts.value.get(label) ?? 0,
        chipColor: LEVEL_CHIP_COLOR[label] ?? 'grey-6',
    })),
);

const levelOptions = computed(() => [
    { label: 'All levels', value: 'all' },
    ...presentLevels.value.map((label) => ({
        label: `${label} (${String(levelCounts.value.get(label) ?? 0)})`,
        value: label,
    })),
]);

// A level that is no longer in the stream must not leave the list filtered
// down to nothing, the same way a node cannot.
watch(levelCounts, (counts) => {
    if (level.value !== 'all' && !counts.has(level.value)) level.value = 'all';
});

const nodeCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const message of properties.messages) {
        const name = message.data.name;
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
});

const nodeOptions = computed(() => [
    { label: 'All nodes', value: 'all' },
    ...[...nodeCounts.value.entries()]
        .toSorted((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
            label: `${name} (${String(count)})`,
            value: name,
        })),
]);

// A node that disappears from the stream (e.g. after a reload with a
// different sample) must not leave the list filtered down to nothing.
watch(nodeCounts, (counts) => {
    if (node.value !== 'all' && !counts.has(node.value)) node.value = 'all';
});

interface Segment {
    text: string;
    match: boolean;
}

/**
 * Splits a line into the parts that match the search term and the parts that
 * do not, so the hit can be marked up in place instead of leaving the reader
 * to find it again by eye.
 */
const highlight = (text: string): Segment[] => {
    const needle = search.value;
    if (needle === '') return [{ text, match: false }];

    const haystack = text.toLowerCase();
    const lowerNeedle = needle.toLowerCase();
    const segments: Segment[] = [];
    let from = 0;
    for (
        let at = haystack.indexOf(lowerNeedle);
        at !== -1;
        at = haystack.indexOf(lowerNeedle, from)
    ) {
        if (at > from)
            segments.push({ text: text.slice(from, at), match: false });
        segments.push({
            text: text.slice(at, at + needle.length),
            match: true,
        });
        from = at + needle.length;
    }
    if (segments.length === 0) return [{ text, match: false }];
    if (from < text.length)
        segments.push({ text: text.slice(from), match: false });
    return segments;
};

const filteredMessages = computed(() => {
    if (!isFiltered.value) return properties.messages;
    const needle = search.value.toLowerCase();
    return properties.messages.filter((message) => {
        const data = message.data;
        if (level.value !== 'all' && levelLabel(data.level) !== level.value)
            return false;
        if (node.value !== 'all' && data.name !== node.value) return false;
        if (needle === '') return true;
        return (
            data.msg.toLowerCase().includes(needle) ||
            data.name.toLowerCase().includes(needle) ||
            (data.file ?? '').toLowerCase().includes(needle) ||
            (data.function ?? '').toLowerCase().includes(needle)
        );
    });
});

// --- Line wrapping ---
// Shared with the action log stream so the two log views behave the same.
const LOG_WRAP_STORAGE_KEY = 'kleinkram.actionLogs.wrapLines';
const readLogWrapPreference = (): boolean => {
    try {
        return localStorage.getItem(LOG_WRAP_STORAGE_KEY) !== 'false';
    } catch {
        return true;
    }
};

const wrapLines = ref(readLogWrapPreference());
watch(wrapLines, (wrap) => {
    try {
        localStorage.setItem(LOG_WRAP_STORAGE_KEY, String(wrap));
    } catch {
        // Preference cannot be persisted; keep it for this view only
    }
});

// --- Source annotation ---
// Off by default: the source location matters while debugging one node, not
// while reading the stream, and it costs a chunk of every line.
const LOG_SOURCE_STORAGE_KEY = 'kleinkram.rosLogs.showSource';
const showSource = ref(
    (() => {
        try {
            return localStorage.getItem(LOG_SOURCE_STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    })(),
);

watch(showSource, (show) => {
    try {
        localStorage.setItem(LOG_SOURCE_STORAGE_KEY, String(show));
    } catch {
        // Preference cannot be persisted; keep it for this view only
    }
});

// Both toggles change how tall the lines are, so the virtual scroller has to
// measure them again; otherwise it keeps the old heights and the list jumps.
const logScroll = ref<QVirtualScroll | null>(null);
watch([wrapLines, showSource], () => {
    void nextTick(() => {
        logScroll.value?.refresh();
    });
});

// --- Helpers ---
const toDate = (nano: bigint): Date => new Date(Number(nano / 1_000_000n));

/** Time of day, which is what a reader follows down a single recording. */
const formatTime = (nano: bigint): string => {
    const date = toDate(nano);
    if (Number.isNaN(date.getTime())) return 'Invalid Time';

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};

// Copied and downloaded lines carry the date as well: they outlive the view
// they came from, and a recording can cross midnight. Same shape as the
// action log download.
const asPlainText = (): string =>
    filteredMessages.value
        .map(({ logTime, data }) => {
            const date = toDate(logTime);
            const when = Number.isNaN(date.getTime())
                ? 'Invalid Time'
                : formatDate(date, true);
            const line = `[${when}] [${levelLabel(data.level)}] [${data.name}] ${data.msg}`;
            const where = showSource.value ? originPath(data) : '';
            return where === '' ? line : `${line}  (${where})`;
        })
        .join('\n');

async function copyLogs(): Promise<void> {
    await quasarCopy(asPlainText());
    Notify.create({
        message: 'Logs copied',
        color: 'positive',
        timeout: 1000,
    });
}

const downloadLogs = (): void => {
    const blob = new Blob([asPlainText()], { type: 'text/plain' });
    const url = globalThis.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    // `/rosout` would be read as a path separator in the file name
    anchor.download = `${properties.topicName.replaceAll('/', '_').replace(/^_/, '')}.log`;
    anchor.click();
    globalThis.URL.revokeObjectURL(url);
};

const loadMore = (): void => {
    emit('load-more');
};
</script>

<style scoped>
.border-color {
    border: 1px solid #e0e0e0;
}
.border-bottom {
    border-bottom: 1px solid #e0e0e0;
}

.log-output {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.8em;
}

.log-line {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 1px 0;
    border-bottom: 1px solid #eeeeee;
}

.log-line:last-child {
    border-bottom: none;
}

/* Marks the line under the cursor, which is what the source tooltip used to
   do, without covering the lines below it. */
.log-line:hover {
    background: rgba(0, 0, 0, 0.04);
}

.log-line__time {
    color: #757575;
    flex: 0 0 auto;
    user-select: none;
}

.log-line__level {
    flex: 0 0 auto;
    min-width: 46px;
    font-weight: 700;
    user-select: none;
}

.log-line__node {
    flex: 0 0 160px;
    max-width: 160px;
    color: #424242;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.log-line__source {
    margin-left: 12px;
    color: #9e9e9e;
    white-space: nowrap;
}

.log-line__match {
    background: #ffe082;
    border-radius: 2px;
}

.log-line__message {
    color: #212121;
    flex: 1 1 auto;
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

/* "Wrap lines" off: every entry stays on a single line and the whole log
   scrolls horizontally, which keeps the columns aligned. */
.log-output--nowrap :deep(.log-line__message),
.log-output--nowrap .log-line__message {
    white-space: pre;
    overflow-wrap: normal;
}

.log-output--nowrap .log-line {
    width: max-content;
    min-width: 100%;
}

@media (max-width: 599px) {
    /* Phones: the message moves onto its own line below the meta columns */
    .log-line {
        flex-wrap: wrap;
        gap: 2px 6px;
        padding: 4px 0;
    }

    .log-line__message {
        flex: 1 0 100%;
    }

    .log-line__node {
        flex: 0 1 auto;
        max-width: 50%;
    }
}
</style>
