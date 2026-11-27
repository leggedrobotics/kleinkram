<template>
    <div class="text-log-viewer bg-white rounded-borders border-color">
        <div class="q-pa-md border-bottom column q-gutter-y-sm">
            <div class="row justify-between items-center q-gutter-sm">
                <div class="row items-center q-gutter-sm">
                    <app-search-bar
                        v-model="search"
                        placeholder="Search logs..."
                        :style="$q.screen.xs ? undefined : 'width: 240px'"
                    />
                    <!-- One chip per level found; a click filters to it, so
                         the few warnings among thousands of lines are one
                         click away. -->
                    <q-chip
                        v-for="entry in levelSummary"
                        :key="entry.label"
                        dense
                        clickable
                        :outline="level !== entry.label"
                        :color="entry.chipColor"
                        :text-color="
                            level === entry.label ? 'white' : entry.chipColor
                        "
                        class="text-weight-medium"
                        @click="() => toggleLevel(entry.label)"
                    >
                        {{ formatCount(entry.count) }} {{ entry.label }}
                    </q-chip>
                </div>

                <div class="row items-center q-gutter-x-xs">
                    <q-btn-toggle
                        v-if="isPartial"
                        v-model="part"
                        dense
                        no-caps
                        unelevated
                        toggle-color="primary"
                        color="grey-2"
                        text-color="grey-9"
                        size="sm"
                        :options="[
                            { label: 'Start', value: 'start' },
                            { label: 'End', value: 'end' },
                        ]"
                        class="q-mr-sm"
                    />
                    <q-toggle
                        v-model="wrapLines"
                        label="Wrap lines"
                        color="primary"
                        dense
                        left-label
                    />
                    <q-btn
                        icon="sym_o_content_copy"
                        flat
                        round
                        dense
                        size="sm"
                        color="grey-7"
                        :disable="filteredLines.length === 0"
                        @click="copyLines"
                    >
                        <q-tooltip>Copy shown lines</q-tooltip>
                    </q-btn>
                </div>
            </div>
        </div>

        <div
            v-if="window === undefined && !failed"
            class="row items-center q-gutter-sm text-grey-7 q-pa-md"
        >
            <q-spinner-dots size="1.5em" /> <span>Loading content...</span>
        </div>

        <div v-else-if="failed" class="q-pa-md text-negative">
            <q-icon name="sym_o_warning" /> The log could not be loaded.
        </div>

        <div
            v-else-if="filteredLines.length === 0"
            class="q-pa-lg text-center text-grey-7"
        >
            <template v-if="lines.length === 0">The log is empty.</template>
            <template v-else>
                <div>No line matches the filter.</div>
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
            :items="filteredLines"
            :virtual-scroll-item-size="20"
            class="log-output"
            :class="{ 'log-output--nowrap': !wrapLines }"
            style="max-height: 600px"
        >
            <template #default="{ item }">
                <div
                    :key="item.number"
                    class="log-line"
                    :class="`log-line--${item.level ?? 'none'}`"
                >
                    <span v-if="showNumbers" class="log-line__number">{{
                        item.number
                    }}</span>
                    <span class="log-line__text"
                        ><span
                            v-for="(segment, at) in highlight(item.text)"
                            :key="at"
                            :class="{ 'log-line__match': segment.match }"
                            >{{ segment.text }}</span
                        ></span
                    >
                </div>
            </template>
        </q-virtual-scroll>

        <div
            v-if="window"
            class="log-footer text-caption text-grey-7 q-px-md q-py-xs"
        >
            {{ formatCount(filteredLines.length) }} of
            {{ formatCount(lines.length) }} lines
            <template v-if="isPartial">
                · {{ part === 'start' ? 'first' : 'last' }}
                {{ formatSize(window.end - window.start) }} of
                {{ formatSize(size) }}
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { detectLineLevels, LogLevel } from '@kleinkram/shared';
import AppSearchBar from 'components/common/app-search-bar.vue';
import {
    Notify,
    copyToClipboard as quasarCopy,
    QVirtualScroll,
    useQuasar,
} from 'quasar';
import { formatSize as formatSizeWithUnit } from 'src/services/general-formatting';
import {
    fetchTextLogWindow,
    TEXT_LOG_WINDOW_BYTES,
    TextLogWindow,
} from 'src/services/log-preview';
import { computed, nextTick, ref, watch } from 'vue';

const $q = useQuasar();

const properties = defineProps<{
    url: string;
    size: number;
}>();

// --- Loading ---
const part = ref<'start' | 'end'>('start');
const window = ref<TextLogWindow | undefined>(undefined);
const failed = ref(false);
const isPartial = computed(() => properties.size > TEXT_LOG_WINDOW_BYTES);

watch(
    [(): string => properties.url, part],
    async ([url, requested]) => {
        window.value = undefined;
        failed.value = false;
        try {
            const loaded = await fetchTextLogWindow(
                url,
                properties.size,
                requested,
            );
            if (url !== properties.url || requested !== part.value) return;
            window.value = loaded;
            failed.value = loaded === undefined;
        } catch (error) {
            console.error(error);
            if (url !== properties.url || requested !== part.value) return;
            failed.value = true;
        }
    },
    { immediate: true },
);

// --- Lines ---
interface LogLine {
    number: number;
    text: string;
    level: LogLevel | undefined;
}

// Terminal loggers colour their output; the escape codes are noise here.
const ANSI_ESCAPE = /\u001B\[[0-9;?]*[ -/]*[@-~]/g;

const lines = computed<LogLine[]>(() => {
    const text = window.value?.text;
    if (!text) return [];
    const raw = text.replaceAll(ANSI_ESCAPE, '').split(/\r?\n/);
    if (raw.at(-1) === '') raw.pop();
    const levels = detectLineLevels(raw);
    return raw.map((line, index) => ({
        number: index + 1,
        text: line,
        level: levels[index],
    }));
});

// Line numbers are only true when the window starts at the top of the file.
const showNumbers = computed(() => window.value?.start === 0);

// --- Filters ---
const search = ref('');
const level = ref<LogLevel | 'all'>('all');

const clearFilters = (): void => {
    search.value = '';
    level.value = 'all';
};

const toggleLevel = (label: LogLevel): void => {
    level.value = level.value === label ? 'all' : label;
};

const LEVEL_CHIP_COLOR: Record<LogLevel, string> = {
    FATAL: 'negative',
    ERROR: 'negative',
    WARN: 'orange-9',
    INFO: 'blue-grey-6',
    DEBUG: 'grey-6',
};

const LEVELS_BY_SEVERITY: LogLevel[] = [
    'FATAL',
    'ERROR',
    'WARN',
    'INFO',
    'DEBUG',
];

const levelSummary = computed(() => {
    const counts = new Map<LogLevel, number>();
    for (const line of lines.value) {
        if (line.level)
            counts.set(line.level, (counts.get(line.level) ?? 0) + 1);
    }
    return LEVELS_BY_SEVERITY.filter((label) => counts.has(label)).map(
        (label) => ({
            label,
            count: counts.get(label) ?? 0,
            chipColor: LEVEL_CHIP_COLOR[label],
        }),
    );
});

// The other part of the file may not have the level that was selected.
watch(levelSummary, (summary) => {
    if (
        level.value !== 'all' &&
        !summary.some((entry) => entry.label === level.value)
    )
        level.value = 'all';
});

const filteredLines = computed(() => {
    const needle = search.value.toLowerCase();
    if (needle === '' && level.value === 'all') return lines.value;
    return lines.value.filter(
        (line) =>
            (level.value === 'all' || line.level === level.value) &&
            (needle === '' || line.text.toLowerCase().includes(needle)),
    );
});

interface Segment {
    text: string;
    match: boolean;
}

const highlight = (text: string): Segment[] => {
    const needle = search.value.toLowerCase();
    if (needle === '') return [{ text, match: false }];
    const haystack = text.toLowerCase();
    const segments: Segment[] = [];
    let from = 0;
    for (
        let at = haystack.indexOf(needle);
        at !== -1;
        at = haystack.indexOf(needle, from)
    ) {
        if (at > from)
            segments.push({ text: text.slice(from, at), match: false });
        segments.push({
            text: text.slice(at, at + needle.length),
            match: true,
        });
        from = at + needle.length;
    }
    if (from < text.length)
        segments.push({ text: text.slice(from), match: false });
    return segments;
};

// --- Line wrapping ---
// Shared with the other log views so they all behave the same.
const LOG_WRAP_STORAGE_KEY = 'kleinkram.actionLogs.wrapLines';
const wrapLines = ref(
    (() => {
        try {
            return localStorage.getItem(LOG_WRAP_STORAGE_KEY) !== 'false';
        } catch {
            return true;
        }
    })(),
);
const logScroll = ref<QVirtualScroll | null>(null);
watch(wrapLines, (wrap) => {
    try {
        localStorage.setItem(LOG_WRAP_STORAGE_KEY, String(wrap));
    } catch {
        // Preference cannot be persisted; keep it for this view only
    }
    // Line heights change, so the virtual scroller has to measure again.
    void nextTick(() => logScroll.value?.refresh());
});

// --- Helpers ---
const formatCount = (value: number): string => value.toLocaleString('de-CH');
const formatSize = (bytes: number): string =>
    formatSizeWithUnit(bytes, 1000, 1);

async function copyLines(): Promise<void> {
    await quasarCopy(filteredLines.value.map((line) => line.text).join('\n'));
    Notify.create({
        message: 'Lines copied',
        color: 'positive',
        timeout: 1000,
    });
}
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
    background: #fafafa;
}

.log-line {
    display: flex;
    gap: 12px;
    padding: 1px 8px 1px 6px;
    border-left: 3px solid transparent;
}

.log-line:hover {
    background: rgba(0, 0, 0, 0.04);
}

.log-line--FATAL,
.log-line--ERROR {
    border-left-color: #c10015;
    background: #fff1f1;
}

.log-line--WARN {
    border-left-color: #f2c037;
    background: #fdf6e3;
}

.log-line--INFO {
    border-left-color: #b0bec5;
}

.log-line--DEBUG {
    color: #757575;
}

.log-line__number {
    flex: 0 0 auto;
    min-width: 40px;
    text-align: right;
    color: #9e9e9e;
    user-select: none;
}

.log-line__text {
    flex: 1 1 auto;
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.log-line__match {
    background: #ffe082;
    border-radius: 2px;
}

/* "Wrap lines" off: every line stays on one row and the log scrolls sideways */
.log-output--nowrap .log-line__text {
    white-space: pre;
    overflow-wrap: normal;
}

.log-output--nowrap .log-line {
    width: max-content;
    min-width: 100%;
}

.log-footer {
    border-top: 1px solid #e0e0e0;
}
</style>
