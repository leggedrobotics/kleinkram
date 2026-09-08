<template>
    <div class="diagnostics-viewer q-gutter-y-md">
        <!-- Top-Level Summary Card -->
        <q-card flat bordered class="summary-card glass-container">
            <q-card-section class="row items-center justify-between q-py-md">
                <div class="column">
                    <div
                        class="text-subtitle1 text-weight-bold row items-center q-gutter-x-sm"
                    >
                        <q-icon
                            :name="overallHealth.icon"
                            :color="overallHealth.color"
                            size="md"
                        />
                        <span
                            :class="
                                `text-${overallHealth.color}-9` || 'text-grey-9'
                            "
                            >{{ overallHealth.title }}</span
                        >
                    </div>
                    <div class="text-caption text-grey-7">
                        Aggregated state from {{ messages.length }} messages on
                        topic
                        <code>{{ topicName }}</code>
                    </div>
                </div>
                <div class="row q-gutter-xs">
                    <q-chip
                        v-for="lvl in [0, 1, 2, 3]"
                        :key="lvl"
                        clickable
                        :outline="!selectedLevels.includes(lvl)"
                        :color="getLevelColor(lvl)"
                        text-color="white"
                        class="text-weight-bold"
                        @click="() => toggleLevelFilter(lvl)"
                    >
                        <q-icon :name="getLevelIcon(lvl)" class="q-mr-xs" />
                        {{ getLevelLabel(lvl) }}: {{ levelCounts[lvl] }}
                    </q-chip>
                </div>
            </q-card-section>

            <!-- Topic Stale Banner -->
            <q-slide-transition>
                <div
                    v-show="isTopicStale"
                    class="bg-amber-1 text-amber-9 q-pa-sm border-top row items-center justify-center text-caption q-gutter-x-sm"
                >
                    <q-icon name="sym_o_warning" />
                    <span
                        ><strong>Diagnostics Feed Stale:</strong> No updates
                        received in the last 5 seconds.</span
                    >
                </div>
            </q-slide-transition>
        </q-card>

        <!-- Playback Controls -->
        <q-card
            v-if="messages.length > 0"
            flat
            bordered
            class="q-pa-sm glass-container q-mb-md"
        >
            <PlaybackControls
                v-model="currentIndex"
                :max="messages.length - 1"
                :is-playing="isPlaying"
                @toggle="togglePlay"
                @next="handleNext"
                @prev="handlePrevious"
            />
        </q-card>

        <!-- Dashboard Tabs -->
        <div class="row justify-between items-center q-mx-xs">
            <q-tabs
                v-model="activeTab"
                dense
                no-caps
                inline-label
                class="text-grey-7 q-mb-sm"
                active-color="primary"
                indicator-color="primary"
            >
                <q-tab
                    name="grid"
                    icon="sym_o_grid_view"
                    label="System Matrix"
                />
                <q-tab
                    name="metrics"
                    icon="sym_o_bar_chart"
                    label="Live Metrics"
                />
                <q-tab
                    name="alerts"
                    icon="sym_o_warning"
                    label="Active Issues"
                />
            </q-tabs>

            <!-- Search & Filters (Shown only on Matrix and Alerts tabs) -->
            <div
                v-if="activeTab === 'grid' || activeTab === 'alerts'"
                class="row q-col-gutter-sm items-center"
                style="min-width: 320px"
            >
                <q-input
                    v-model="searchQuery"
                    dense
                    outlined
                    placeholder="Search by node name..."
                    bg-color="white"
                    class="col dark-input"
                >
                    <template #append>
                        <q-icon
                            v-if="searchQuery"
                            name="sym_o_close"
                            class="cursor-pointer"
                            @click="clearSearch"
                        />
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>
                <q-btn
                    v-if="selectedLevels.length < 4"
                    flat
                    dense
                    size="sm"
                    color="primary"
                    label="Reset"
                    icon="sym_o_refresh"
                    @click="resetFilters"
                />
            </div>
        </div>

        <q-separator />

        <!-- Tab Panels -->
        <q-tab-panels
            v-model="activeTab"
            animated
            swipeable
            class="bg-transparent"
            style="min-height: 300px"
        >
            <!-- 1. System Grid (Matrix View) -->
            <q-tab-panel name="grid" class="q-pa-none">
                <div v-if="hasNodes" class="q-gutter-y-md">
                    <div v-for="catName in categories" :key="catName">
                        <div
                            v-if="groupedNodes[catName]?.length"
                            class="text-subtitle2 text-weight-bold text-grey-8 q-mb-sm q-px-sm"
                        >
                            {{ catName }} ({{
                                groupedNodes[catName]?.length ?? 0
                            }})
                        </div>
                        <div class="row q-col-gutter-sm q-mb-md">
                            <TransitionGroup name="node-list">
                                <div
                                    v-for="node in groupedNodes[catName]"
                                    :key="node.name"
                                    class="col-12 col-sm-6 col-md-4 col-lg-3 node-card-wrapper"
                                >
                                    <q-card
                                        flat
                                        class="node-grid-card cursor-pointer transition-generic"
                                        :style="getNodeStyle(node.level)"
                                        @click="() => openInspector(node.name)"
                                    >
                                        <q-card-section
                                            class="q-pa-sm column justify-between col"
                                        >
                                            <div
                                                class="row items-center justify-between no-wrap"
                                            >
                                                <span
                                                    class="font-mono text-weight-bold text-caption text-grey-9 text-ellipsis col"
                                                    >{{
                                                        formatNodeName(
                                                            node.name,
                                                        )
                                                    }}</span
                                                >
                                                <q-icon
                                                    :name="
                                                        getLevelIcon(node.level)
                                                    "
                                                    :color="
                                                        getLevelColor(
                                                            node.level,
                                                        )
                                                    "
                                                    size="xs"
                                                    class="q-ml-xs"
                                                />
                                            </div>

                                            <div
                                                class="text-caption text-grey-6 text-ellipsis q-my-sm"
                                            >
                                                {{
                                                    node.message || 'No message'
                                                }}
                                            </div>

                                            <div
                                                class="row justify-between items-center no-wrap"
                                            >
                                                <span
                                                    class="text-xxs text-grey-5 font-mono"
                                                >
                                                    {{
                                                        getShortTime(
                                                            node.lastUpdatedNanos,
                                                        )
                                                    }}
                                                </span>
                                                <q-chip
                                                    dense
                                                    size="10px"
                                                    :color="
                                                        getLevelColor(
                                                            node.level,
                                                        )
                                                    "
                                                    text-color="white"
                                                    class="text-weight-bold q-ma-none"
                                                    :label="
                                                        getLevelLabel(
                                                            node.level,
                                                        )
                                                    "
                                                />
                                            </div>
                                        </q-card-section>
                                    </q-card>
                                </div>
                            </TransitionGroup>
                        </div>
                    </div>
                </div>
                <div
                    v-else
                    class="text-center q-pa-xl text-grey bg-white rounded-borders border-color glass-container"
                >
                    <q-icon
                        name="sym_o_search_off"
                        size="xl"
                        class="q-mb-md text-grey-4"
                    />
                    <div class="text-subtitle1">No Nodes Found</div>
                    <div class="text-caption">
                        Adjust your search query or filter settings.
                    </div>
                </div>
            </q-tab-panel>

            <!-- 2. Live Metrics & Telemetry Gauges -->
            <q-tab-panel name="metrics" class="q-pa-none">
                <div v-if="liveMetrics.length > 0" class="row q-col-gutter-sm">
                    <div
                        v-for="(metric, idx) in liveMetrics"
                        :key="idx"
                        class="col-12 col-sm-6 col-md-4 col-lg-3"
                    >
                        <q-card
                            flat
                            bordered
                            class="metric-gauge-card glass-container cursor-pointer"
                            @click="() => openInspector(metric.nodeName)"
                        >
                            <q-card-section
                                class="q-pa-md column justify-between full-height"
                            >
                                <div
                                    class="row items-center justify-between q-mb-sm"
                                >
                                    <span
                                        class="text-xxs text-weight-bold text-grey-6 text-ellipsis"
                                    >
                                        {{ formatNodeName(metric.nodeName) }}
                                    </span>
                                    <q-icon
                                        :name="getMetricIcon(metric.type)"
                                        color="grey-6"
                                        size="xs"
                                    />
                                </div>

                                <div
                                    class="row items-baseline justify-between q-my-xs"
                                >
                                    <span
                                        class="text-caption text-weight-bold text-grey-8"
                                        >{{ metric.key }}</span
                                    >
                                    <span
                                        class="text-h6 text-weight-bolder font-mono"
                                        :class="`text-${metric.color}`"
                                    >
                                        {{ metric.value }}
                                    </span>
                                </div>

                                <q-linear-progress
                                    :value="metric.ratio"
                                    :color="metric.color"
                                    class="rounded-borders q-mt-sm"
                                    style="height: 6px"
                                />
                            </q-card-section>
                        </q-card>
                    </div>
                </div>
                <div
                    v-else
                    class="text-center q-pa-xl text-grey bg-white rounded-borders border-color glass-container"
                >
                    <q-icon
                        name="sym_o_speed"
                        size="xl"
                        class="q-mb-md text-grey-4"
                    />
                    <div class="text-subtitle1">
                        No Numeric Telemetry Detected
                    </div>
                    <div class="text-caption">
                        Frequency or percentage values are not reported in
                        current messages.
                    </div>
                </div>
            </q-tab-panel>

            <!-- 3. Active Issues Feed -->
            <q-tab-panel name="alerts" class="q-pa-none">
                <div v-if="activeIssues.length > 0" class="q-gutter-y-xs">
                    <div
                        v-for="issue in activeIssues"
                        :key="issue.name"
                        class="row items-center justify-between q-pa-md hover-item rounded-borders border-left-status cursor-pointer glass-container q-mb-sm"
                        :style="getNodeStyle(issue.level)"
                        @click="() => openInspector(issue.name)"
                    >
                        <div class="column col-12 col-sm-8">
                            <div class="row items-center q-gutter-x-sm q-mb-xs">
                                <q-chip
                                    dense
                                    size="xs"
                                    :color="
                                        issue.level === 2 ? 'red' : 'orange'
                                    "
                                    text-color="white"
                                    class="text-weight-bold"
                                    :label="getLevelLabel(issue.level)"
                                />
                                <span
                                    class="font-mono text-weight-bold text-body2 text-grey-9"
                                    >{{ issue.name }}</span
                                >
                            </div>
                            <span class="text-caption text-grey-7">{{
                                issue.message || 'No description provided'
                            }}</span>
                        </div>
                        <div
                            class="column items-end col-12 col-sm-4 text-right text-caption text-grey-5 font-mono"
                        >
                            <span
                                >Updated:
                                {{ formatNanos(issue.lastUpdatedNanos) }}</span
                            >
                            <span
                                >HW ID:
                                {{ issue.hardware_id || 'Unknown' }}</span
                            >
                        </div>
                    </div>
                </div>
                <div
                    v-else
                    class="nominal-banner q-pa-xl rounded-borders flex flex-center column q-gutter-y-md glass-container"
                >
                    <q-icon name="sym_o_check_circle" color="green" size="xl" />
                    <div class="text-subtitle1 text-green-9 text-weight-bold">
                        All Systems Nominal
                    </div>
                    <div class="text-caption text-grey-7">
                        No errors or warnings are currently active.
                    </div>
                </div>
            </q-tab-panel>
        </q-tab-panels>

        <!-- Slide-out Node Inspector Drawer Dialog -->
        <q-dialog v-model="isInspectorOpen" position="right" full-height>
            <q-card
                style="width: 450px; max-width: 90vw"
                class="column full-height glass-drawer"
            >
                <!-- Drawer Header -->
                <q-card-section
                    class="row items-center justify-between q-pb-md border-bottom bg-grey-2 dark-bg-grey-10"
                >
                    <div class="column col">
                        <span
                            class="font-mono text-weight-bold text-subtitle1 text-grey-9 text-ellipsis"
                            >{{ selectedNodeName }}</span
                        >
                        <span class="text-caption text-grey-6"
                            >Diagnostics Inspection</span
                        >
                    </div>
                    <q-btn v-close-popup icon="sym_o_close" flat round dense />
                </q-card-section>

                <!-- Drawer Body (Scrollable) -->
                <q-card-section class="col overflow-auto q-gutter-y-md q-py-lg">
                    <!-- Node Health Status Card -->
                    <div
                        class="q-pa-md rounded-borders border-left-status"
                        :style="getNodeStyle(selectedNode.level)"
                    >
                        <div class="row items-center justify-between">
                            <div class="row items-center q-gutter-x-sm">
                                <q-icon
                                    :name="getLevelIcon(selectedNode.level)"
                                    :color="getLevelColor(selectedNode.level)"
                                    size="md"
                                />
                                <div class="column">
                                    <span
                                        class="text-subtitle2 text-weight-bold text-grey-9"
                                    >
                                        Status:
                                        {{ getLevelLabel(selectedNode.level) }}
                                    </span>
                                    <span class="text-caption text-grey-6">
                                        Last updated:
                                        {{
                                            formatNanos(
                                                selectedNode.lastUpdatedNanos,
                                            )
                                        }}
                                    </span>
                                </div>
                            </div>
                            <q-chip
                                :color="getLevelColor(selectedNode.level)"
                                text-color="white"
                                class="text-weight-bold"
                                :label="getLevelLabel(selectedNode.level)"
                            />
                        </div>
                        <div
                            v-if="selectedNode.message"
                            class="text-body2 text-grey-8 q-mt-md text-weight-medium bg-white dark-bg-grey-9 q-pa-sm rounded-borders border-dashed"
                        >
                            {{ selectedNode.message }}
                        </div>
                    </div>

                    <!-- Hardware ID -->
                    <div
                        v-if="selectedNode.hardware_id"
                        class="row items-center q-px-sm text-grey-7"
                    >
                        <q-icon
                            name="sym_o_developer_board"
                            size="xs"
                            class="q-mr-xs text-primary"
                        />
                        <span
                            >Hardware ID:
                            <strong class="text-grey-9 font-mono">{{
                                selectedNode.hardware_id
                            }}</strong></span
                        >
                    </div>

                    <!-- Values Listing -->
                    <div class="column">
                        <span
                            class="text-subtitle2 text-weight-bold text-grey-8 q-mb-sm"
                            >Diagnostic Details</span
                        >

                        <!-- Frequency Progress Bar if available -->
                        <div
                            v-if="selectedNodeVisualValues.freqData"
                            class="q-mb-md freq-bar-container q-pa-sm rounded-borders"
                        >
                            <div
                                class="row items-center justify-between text-weight-medium q-mb-xs"
                            >
                                <span class="row items-center text-grey-8">
                                    <q-icon
                                        name="sym_o_speed"
                                        size="xs"
                                        class="q-mr-xs text-primary"
                                    />
                                    Frequency Performance
                                </span>
                                <span
                                    class="text-caption text-primary text-weight-bold"
                                >
                                    {{
                                        selectedNodeVisualValues.freqData.actual
                                    }}
                                    Hz /
                                    {{
                                        selectedNodeVisualValues.freqData
                                            .expected
                                    }}
                                    Hz
                                </span>
                            </div>
                            <q-linear-progress
                                :value="selectedNodeVisualValues.freqData.ratio"
                                color="primary"
                                class="rounded-borders"
                                style="height: 8px"
                            />
                            <div
                                class="row justify-between text-grey-6 text-xxs q-mt-xs"
                            >
                                <span>0 Hz</span>
                                <span
                                    >Ratio:
                                    {{
                                        selectedNodeVisualValues.freqData
                                            .percent
                                    }}%</span
                                >
                                <span>Target</span>
                            </div>
                        </div>

                        <!-- Complete grid list of all key values -->
                        <div
                            v-if="
                                selectedNodeVisualValues.visualList.length > 0
                            "
                            class="column q-gutter-y-xs"
                        >
                            <div
                                v-for="item in selectedNodeVisualValues.visualList"
                                :key="item.key"
                                class="q-pa-sm rounded-borders border-dashed row items-center justify-between"
                            >
                                <span
                                    class="text-grey-7 text-weight-bold font-mono text-xs"
                                    >{{ item.key }}</span
                                >
                                <div class="row items-center q-gutter-x-sm">
                                    <span
                                        v-if="!item.isProgress"
                                        class="text-grey-9 font-mono text-xs text-weight-bold break-all"
                                        >{{ item.value }}</span
                                    >
                                    <div
                                        v-else
                                        class="row items-center q-gutter-x-xs"
                                        style="min-width: 150px"
                                    >
                                        <q-linear-progress
                                            :value="item.ratio"
                                            :color="item.color"
                                            class="col rounded-borders"
                                            style="height: 6px"
                                        />
                                        <span
                                            class="text-xxs font-mono text-grey-9 text-weight-bold"
                                            >{{ item.value }}</span
                                        >
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div
                            v-else
                            class="text-grey-5 italic q-pa-sm text-center"
                        >
                            No diagnostics values reported.
                        </div>
                    </div>

                    <!-- Transition History Timeline -->
                    <div
                        v-if="selectedNodeHistory.length > 0"
                        class="column q-mt-md"
                    >
                        <span
                            class="text-subtitle2 text-weight-bold text-grey-8 q-mb-sm"
                            >Status Transition History</span
                        >
                        <q-timeline color="primary" dense class="q-px-sm">
                            <q-timeline-entry
                                v-for="(event, idx) in selectedNodeHistory
                                    .slice()
                                    .reverse()"
                                :key="idx"
                                :color="getLevelColor(event.level)"
                                :icon="getLevelIcon(event.level)"
                                side="right"
                            >
                                <div class="row items-center justify-between">
                                    <span
                                        class="text-weight-bold"
                                        :class="
                                            `text-${getLevelColor(event.level)}-9` ||
                                            'text-grey-9'
                                        "
                                    >
                                        {{ getLevelLabel(event.level) }}
                                    </span>
                                    <span
                                        class="text-caption text-grey-5 font-mono"
                                    >
                                        {{ event.time.toFixed(2) }}s
                                    </span>
                                </div>
                                <div class="text-caption text-grey-7">
                                    {{ event.message || 'State transition' }}
                                </div>
                            </q-timeline-entry>
                        </q-timeline>
                    </div>
                </q-card-section>
            </q-card>
        </q-dialog>
    </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/naming-convention */
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import PlaybackControls from './playback-controls.vue';

// --- Type Safety Definitions ---
export interface KeyValue {
    key: string;
    value: string;
}

export interface DiagnosticStatus {
    level?: number;
    name?: string;
    message?: string;
    hardware_id?: string;
    values?: KeyValue[];
}

export interface DiagnosticArray {
    header?: {
        seq?: number;
        stamp?: { sec: number; nsec: number };
        frame_id?: string;
    };
    status?: DiagnosticStatus[];
}

export interface DiagnosticMessage {
    logTime?: bigint;
    data?: DiagnosticArray;
}

interface StatusTransition {
    time: number;
    level: number;
    message: string;
}

// --- Props ---
const properties = defineProps<{
    messages: DiagnosticMessage[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required']);

// --- Local State ---
const activeTab = ref('grid');
const searchQuery = ref('');
const selectedLevels = ref<number[]>([0, 1, 2, 3]);
const isTopicStale = ref(false);
const lastMessageReceivedTime = ref(Date.now());

// Playback slider state
const currentIndex = ref(0);
const isPlaying = ref(false);
let intervalId: ReturnType<typeof setInterval> | null = null;

const togglePlay = (): void => {
    isPlaying.value = !isPlaying.value;
    if (isPlaying.value) {
        intervalId = setInterval(() => {
            step(1);
        }, 200); // 5 FPS
    } else {
        if (intervalId) {
            clearInterval(intervalId);
        }
    }
};

const step = (direction: number): void => {
    let next = currentIndex.value + direction;
    if (next >= properties.messages.length) {
        next = 0; // Loop
    } else if (next < 0) {
        next = properties.messages.length - 1;
    }
    currentIndex.value = next;
};

const handleNext = (): void => {
    step(1);
};

const handlePrevious = (): void => {
    step(-1);
};

onUnmounted(() => {
    if (intervalId) {
        clearInterval(intervalId);
    }
});

// Drawer Inspector State
const isInspectorOpen = ref(false);
const selectedNodeName = ref('');

// Health transitions tracker
const nodeHistory = ref<Record<string, StatusTransition[]>>({});
const selectedNodeHistory = computed(
    () => nodeHistory.value[selectedNodeName.value] ?? [],
);

// Normalized Time helper
const startTime = ref<bigint | null>(null);

// --- Lifecycle ---
onMounted(() => {
    if (properties.messages.length === 0) {
        emit('load-required');
    }
});

// Update the message timestamp and current index when messages grow
watch(
    () => properties.messages.length,
    (newLength, oldLength) => {
        lastMessageReceivedTime.value = Date.now();
        isTopicStale.value = false;

        if (
            newLength > 0 &&
            (oldLength === 0 || !isPlaying.value) &&
            (currentIndex.value === (oldLength ?? 0) - 1 ||
                (oldLength ?? 0) === 0)
        ) {
            currentIndex.value = newLength - 1;
        }
    },
    { immediate: true },
);

// Realtime Stale checking timer
let staleTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
    staleTimer = globalThis.setInterval(() => {
        if (properties.messages.length > 0) {
            const elapsed = Date.now() - lastMessageReceivedTime.value;
            if (elapsed > 5000) {
                isTopicStale.value = true;
            }
        }
    }, 1000);
});

onUnmounted(() => {
    if (staleTimer) {
        clearInterval(staleTimer);
    }
});

// --- Node Aggregation & Incremental Parsing ---
const latestLogTime = computed(() => {
    if (properties.messages.length === 0) return 0n;
    return properties.messages.at(-1)?.logTime ?? 0n;
});

const getNodeLevel = (node: {
    level: number;
    lastUpdatedNanos: bigint;
}): number => {
    if (
        latestLogTime.value > 0n &&
        latestLogTime.value - node.lastUpdatedNanos > 5_000_000_000n
    ) {
        return 3; // STALE (Grey)
    }
    return node.level;
};

interface AggregatedNode {
    level: number;
    name: string;
    message: string;
    hardware_id: string;
    values: KeyValue[];
    lastUpdatedNanos: bigint;
}

const aggregatedMap = shallowRef<Record<string, AggregatedNode>>({});

watch(
    [() => properties.messages, currentIndex],
    ([newMessages, newIndex]) => {
        const limit = newIndex;
        if (
            newMessages.length === 0 ||
            limit < 0 ||
            limit >= newMessages.length
        ) {
            aggregatedMap.value = {};
            startTime.value = null;
            nodeHistory.value = {};
            return;
        }

        const map: Record<string, AggregatedNode> = {};
        const history: Record<string, StatusTransition[]> = {};
        let start: bigint | null = null;

        for (let index = 0; index <= limit; index++) {
            const message = newMessages[index];
            if (!message) continue;
            const statuses = message.data?.status ?? [];
            const logTime = message.logTime ?? 0n;

            start ??= logTime;
            const timestamp = Number(logTime - start) / 1_000_000_000;

            for (const status of statuses) {
                if (!status.name) continue;

                const previousNode = map[status.name];
                const newLevel = status.level ?? 0;

                // Record health transition history
                if (previousNode?.level !== newLevel) {
                    const nodeTransitions = history[status.name] ?? [];
                    nodeTransitions.push({
                        time: timestamp,
                        level: newLevel,
                        message: status.message ?? '',
                    });

                    // Cap history size to prevent memory growth
                    if (nodeTransitions.length > 50) {
                        nodeTransitions.shift();
                    }
                    history[status.name] = nodeTransitions;
                }

                map[status.name] = {
                    level: newLevel,
                    name: status.name,
                    message: status.message ?? '',
                    hardware_id: status.hardware_id ?? '',
                    values: status.values ?? [],
                    lastUpdatedNanos: logTime,
                };
            }
        }

        aggregatedMap.value = map;
        nodeHistory.value = history;
        startTime.value = start;
    },
    { immediate: true },
);

const aggregatedNodes = computed(() => aggregatedMap.value);

// Overall health calculation
const levelCounts = computed(() => {
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const node of Object.values(aggregatedNodes.value)) {
        const effective = getNodeLevel(node);
        counts[effective as 0 | 1 | 2 | 3]++;
    }
    return counts;
});

const overallHealth = computed(() => {
    const counts = levelCounts.value;
    if (properties.messages.length === 0) {
        return {
            title: 'No Diagnostic Data',
            color: 'grey',
            icon: 'sym_o_help_outline',
        };
    }
    if (counts[2] > 0) {
        return {
            title: `System Critical (${String(counts[2])} Errors)`,
            color: 'red',
            icon: 'sym_o_error',
        };
    }
    if (counts[1] > 0) {
        return {
            title: `System Warnings (${String(counts[1])} Warnings)`,
            color: 'orange',
            icon: 'sym_o_warning',
        };
    }
    if (counts[3] > 0 && counts[0] === 0) {
        return {
            title: 'System Stale / Unknown',
            color: 'grey',
            icon: 'sym_o_help_outline',
        };
    }
    return {
        title: 'All Systems Nominal',
        color: 'green',
        icon: 'sym_o_check_circle',
    };
});

// Active issues (WARN or ERROR)
const activeIssues = computed(() => {
    return Object.values(aggregatedNodes.value)
        .map((node) => ({
            ...node,
            level: getNodeLevel(node),
        }))
        .filter((node) => node.level === 1 || node.level === 2)
        .toSorted((a, b) => b.level - a.level || a.name.localeCompare(b.name));
});

// --- Categorization ---
const categories = [
    'Sensor Streams',
    'Hardware Resource Health',
    'Navigation',
    'Other Diagnostics',
];

const getCategory = (name: string): string => {
    const lower = name.toLowerCase();

    const isSensor = [
        '/imu',
        'imu',
        '/lidar',
        'lidar',
        'sensor',
        'camera',
    ].some((prefix) => lower.includes(prefix));
    if (isSensor) return 'Sensor Streams';

    const isHardware = [
        'cpu',
        'mem',
        'battery',
        'hardware',
        'power',
        'temp',
        'monitor',
        'disk',
    ].some((prefix) => lower.includes(prefix));
    if (isHardware) return 'Hardware Resource Health';

    const isNav = ['goal', 'nav', 'path', 'pose', 'odom', 'twist'].some(
        (prefix) => lower.includes(prefix),
    );
    if (isNav) return 'Navigation';

    return 'Other Diagnostics';
};

const groupedNodes = computed(() => {
    const groups: Record<string, AggregatedNode[]> = {
        'Sensor Streams': [],
        'Hardware Resource Health': [],
        Navigation: [],
        'Other Diagnostics': [],
    };

    const query = searchQuery.value.trim().toLowerCase();

    for (const node of Object.values(aggregatedNodes.value)) {
        const effectiveLvl = getNodeLevel(node);

        // Filters
        if (!selectedLevels.value.includes(effectiveLvl)) continue;
        if (query && !node.name.toLowerCase().includes(query)) continue;

        const cat = getCategory(node.name);
        (groups[cat] ??= []).push({
            ...node,
            level: effectiveLvl,
        });
    }

    // Sort nodes alphabetically within groups
    for (const cat of categories) {
        groups[cat] = (groups[cat] ?? []).toSorted((a, b) =>
            a.name.localeCompare(b.name),
        );
    }

    return groups;
});

const hasNodes = computed(() => {
    return Object.values(groupedNodes.value).some((array) => array.length > 0);
});

// --- Telemetry Metrics Aggregator ---
interface MetricItem {
    nodeName: string;
    key: string;
    value: string;
    parsedValue: number;
    unit: string;
    type: 'frequency' | 'percentage' | 'temperature' | 'other';
    ratio: number;
    color: string;
}

const parseNodeMetrics = (
    node: AggregatedNode,
    freqData: ReturnType<typeof parseFrequencyData>,
): MetricItem[] => {
    const list: MetricItem[] = [];

    for (const item of node.values) {
        const keyLower = item.key.toLowerCase();
        const valueNumber = Number.parseFloat(item.value);
        if (Number.isNaN(valueNumber)) continue;

        let unit = '';
        let type: 'frequency' | 'percentage' | 'temperature' | 'other' =
            'other';
        let ratio = 0;
        let color = 'primary';
        let parsedValue = valueNumber;

        const isHz =
            keyLower.includes('hz') ||
            keyLower.includes('frequency') ||
            keyLower.includes('rate') ||
            keyLower.includes('fps');

        if (isHz) {
            if (
                freqData &&
                (keyLower.includes('actual') ||
                    keyLower === 'frequency' ||
                    keyLower === 'rate' ||
                    keyLower === 'fps')
            )
                continue;
            unit = 'Hz';
            type = 'frequency';
            ratio = 1;
            color = 'primary';
        } else if (
            item.value.includes('%') ||
            keyLower.includes('percent') ||
            keyLower.includes('usage') ||
            keyLower.includes('load') ||
            keyLower.includes('fill_level')
        ) {
            unit = '%';
            type = 'percentage';
            const maxValue = valueNumber > 1 ? 100 : 1;
            ratio = Math.max(0, Math.min(1, valueNumber / maxValue));
            parsedValue = maxValue === 1 ? valueNumber * 100 : valueNumber;
            if (ratio > 0.9) color = 'negative';
            else if (ratio > 0.75) color = 'warning';
            else color = 'positive';
        } else if (
            keyLower.includes('temp') ||
            keyLower.includes('temperature') ||
            keyLower.includes('°c') ||
            keyLower.includes('deg')
        ) {
            unit = '°C';
            type = 'temperature';
            ratio = Math.max(0, Math.min(1, valueNumber / 100));
            if (valueNumber > 80) color = 'negative';
            else if (valueNumber > 65) color = 'warning';
            else color = 'positive';
        } else {
            continue;
        }

        list.push({
            nodeName: node.name,
            key: item.key,
            value: item.value,
            parsedValue: parsedValue,
            unit,
            type,
            ratio,
            color,
        });
    }

    return list;
};

const liveMetrics = computed<MetricItem[]>(() => {
    const list: MetricItem[] = [];

    for (const node of Object.values(aggregatedNodes.value)) {
        const freqData = parseFrequencyData(node.values);
        if (freqData) {
            let color = 'positive';
            if (freqData.ratio < 0.7) color = 'negative';
            else if (freqData.ratio < 0.9) color = 'warning';

            list.push({
                nodeName: node.name,
                key: 'Frequency',
                value: `${String(freqData.actual)} Hz`,
                parsedValue: freqData.actual,
                unit: 'Hz',
                type: 'frequency',
                ratio: freqData.ratio,
                color,
            });
        }

        const nodeMetrics = parseNodeMetrics(node, freqData);
        list.push(...nodeMetrics);
    }

    return list.toSorted(
        (a, b) =>
            a.key.localeCompare(b.key) || a.nodeName.localeCompare(b.nodeName),
    );
});

// --- Node Details Dialog Computeds ---
const selectedNode = computed<AggregatedNode>(() => {
    return (
        aggregatedNodes.value[selectedNodeName.value] ?? {
            level: 3,
            name: '',
            message: '',
            hardware_id: '',
            values: [],
            lastUpdatedNanos: 0n,
        }
    );
});

const selectedNodeVisualValues = computed(() => {
    return getVisualValues(selectedNode.value.values);
});

// --- Formatting Helpers ---
const formatNodeName = (name: string): string => {
    if (!name) return '';
    // Format '/imu_sensor_broadcaster/imu' to 'imu' or clean path
    return name.replace(/^\//, '');
};

const getShortTime = (nano: bigint): string => {
    if (!nano) return '';
    const ms = Number(nano / 1_000_000n);
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return '';
    const parts = date.toISOString().split('T')[1]?.split('.') ?? [];
    return parts[0] ?? '';
};

const formatNanos = (nano?: bigint): string => {
    if (!nano) return '-';
    const ms = Number(nano / 1_000_000n);
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) {
        return 'Invalid Time';
    }
    return date.toISOString().split('T')[1]?.replace('Z', '') ?? 'Invalid Time';
};

const getMetricIcon = (type: string): string => {
    switch (type) {
        case 'frequency': {
            return 'sym_o_speed';
        }
        case 'percentage': {
            return 'sym_o_percent';
        }
        case 'temperature': {
            return 'sym_o_thermostat';
        }
        default: {
            return 'sym_o_bar_chart';
        }
    }
};

// --- Inspector Actions ---
const openInspector = (name: string) => {
    selectedNodeName.value = name;
    isInspectorOpen.value = true;
};

const getLevelColor = (level: number): string => {
    switch (level) {
        case 0: {
            return 'green';
        }
        case 1: {
            return 'orange';
        }
        case 2: {
            return 'red';
        }
        default: {
            return 'grey';
        }
    }
};

const getLevelIcon = (level: number): string => {
    switch (level) {
        case 0: {
            return 'sym_o_check_circle';
        }
        case 1: {
            return 'sym_o_warning';
        }
        case 2: {
            return 'sym_o_error';
        }
        default: {
            return 'sym_o_help_outline';
        }
    }
};

const getLevelLabel = (level: number): string => {
    switch (level) {
        case 0: {
            return 'OK';
        }
        case 1: {
            return 'WARN';
        }
        case 2: {
            return 'ERROR';
        }
        default: {
            return 'STALE';
        }
    }
};

const getNodeStyle = (level: number) => {
    let color = '#9E9E9E';
    let rgb = '158, 158, 158';
    switch (level) {
        case 0: {
            color = '#4CAF50';
            rgb = '76, 175, 80';

            break;
        }
        case 1: {
            color = '#FF9800';
            rgb = '255, 152, 0';

            break;
        }
        case 2: {
            color = '#F44336';
            rgb = '244, 67, 54';

            break;
        }
        // No default
    }
    return {
        '--status-color': color,
        '--status-color-rgb': rgb,
    };
};

// --- Value Visualizer Parsers ---
const parseFrequencyData = (values: KeyValue[]) => {
    let actual: number | null = null;
    let expected: number | null = null;
    let actualKey = '';
    let expectedKey = '';

    for (const item of values) {
        const keyLower = item.key.toLowerCase();
        const valueNumber = Number.parseFloat(item.value);
        if (Number.isNaN(valueNumber)) continue;

        if (
            keyLower.includes('expected') ||
            keyLower.includes('target') ||
            keyLower.includes('desired')
        ) {
            expected = valueNumber;
            expectedKey = item.key;
        } else if (
            keyLower.includes('actual') ||
            keyLower.includes('measured') ||
            keyLower === 'frequency (hz)' ||
            keyLower === 'frequency' ||
            keyLower === 'rate' ||
            keyLower === 'fps'
        ) {
            actual = valueNumber;
            actualKey = item.key;
        }
    }

    if (actual !== null && expected !== null && expected > 0) {
        return {
            actual,
            expected,
            actualKey,
            expectedKey,
            ratio: Math.min(1, actual / expected),
            percent: ((actual / expected) * 100).toFixed(1),
        };
    }
    return null;
};

interface VisualValue {
    key: string;
    value: string;
    isProgress: boolean;
    ratio: number;
    color: string;
}

const getVisualValues = (values: KeyValue[]) => {
    const list: VisualValue[] = [];
    const freqData = parseFrequencyData(values);
    const keysToHide = new Set<string>();

    if (freqData) {
        keysToHide.add(freqData.actualKey);
        keysToHide.add(freqData.expectedKey);
    }

    for (const item of values) {
        if (keysToHide.has(item.key)) continue;

        const keyLower = item.key.toLowerCase();
        let valueClean = item.value.trim();
        let isProgress = false;
        let ratio = 0;
        let color = 'primary';

        if (valueClean.endsWith('%')) {
            const parsedValue = Number.parseFloat(valueClean);
            if (!Number.isNaN(parsedValue)) {
                isProgress = true;
                ratio = Math.max(0, Math.min(1, parsedValue / 100));
                valueClean = `${parsedValue.toFixed(1)}%`;
            }
        } else if (
            keyLower.includes('usage') ||
            keyLower.includes('percent') ||
            keyLower.includes('load') ||
            keyLower.includes('fill_level')
        ) {
            const parsedValue = Number.parseFloat(valueClean);
            if (!Number.isNaN(parsedValue)) {
                const maxValue = parsedValue > 1 ? 100 : 1;
                isProgress = true;
                ratio = Math.max(0, Math.min(1, parsedValue / maxValue));
                valueClean =
                    maxValue === 100
                        ? `${parsedValue.toFixed(1)}%`
                        : `${(parsedValue * 100).toFixed(1)}%`;
            }
        }

        if (isProgress) {
            if (ratio > 0.9) color = 'negative';
            else if (ratio > 0.75) color = 'warning';
            else color = 'positive';
        }

        list.push({
            key: item.key,
            value: valueClean,
            isProgress,
            ratio,
            color,
        });
    }

    return {
        freqData,
        visualList: list,
    };
};

const toggleLevelFilter = (lvl: number) => {
    if (selectedLevels.value.includes(lvl)) {
        selectedLevels.value = selectedLevels.value.filter((l) => l !== lvl);
    } else {
        selectedLevels.value.push(lvl);
    }
};

const clearSearch = () => {
    searchQuery.value = '';
};

const resetFilters = () => {
    selectedLevels.value = [0, 1, 2, 3];
};
</script>

<style scoped>
.glass-container {
    background: rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(10px) saturate(180%);
    border: 1px solid rgba(0, 0, 0, 0.08);
}
.body--dark .glass-container {
    background: rgba(29, 29, 29, 0.45);
    backdrop-filter: blur(10px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.08);
}

.summary-card {
    border-radius: 8px;
}

.nominal-banner {
    background: rgba(76, 175, 80, 0.05);
    border: 1px solid rgba(76, 175, 80, 0.15);
    border-radius: 8px;
}
.body--dark .nominal-banner {
    background: rgba(76, 175, 80, 0.1);
    border: 1px solid rgba(76, 175, 80, 0.25);
}

.hover-item:hover {
    background: rgba(0, 0, 0, 0.02);
}
.body--dark .hover-item:hover {
    background: rgba(255, 255, 255, 0.04);
}

.border-left-status {
    border-left: 4px solid var(--status-color);
    background: rgba(var(--status-color-rgb), 0.03);
}
.body--dark .border-left-status {
    background: rgba(var(--status-color-rgb), 0.06);
}

.node-card-wrapper {
    margin-bottom: 2px;
}

/* 1. Matrix Grid Cards */
.node-grid-card {
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(8px) saturate(180%);
    border: 1px solid rgba(var(--status-color-rgb), 0.25) !important;
    border-radius: 8px;
    box-shadow:
        inset 0 3px 0 var(--status-color),
        0 4px 10px rgba(var(--status-color-rgb), 0.03);
    transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
    min-height: 105px;
    display: flex;
    flex-direction: column;
}
.body--dark .node-grid-card {
    background: rgba(29, 29, 29, 0.55);
    border: 1px solid rgba(var(--status-color-rgb), 0.4) !important;
    box-shadow:
        inset 0 3px 0 var(--status-color),
        0 4px 12px rgba(var(--status-color-rgb), 0.1);
}
.node-grid-card:hover {
    transform: translateY(-2px);
    box-shadow:
        inset 0 3px 0 var(--status-color),
        0 8px 16px rgba(var(--status-color-rgb), 0.25);
    border-color: rgba(var(--status-color-rgb), 0.6) !important;
}

/* 2. Live Metrics Cards */
.metric-gauge-card {
    border-radius: 8px;
    transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.metric-gauge-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
}
.body--dark .metric-gauge-card:hover {
    box-shadow: 0 8px 16px rgba(255, 255, 255, 0.05);
}

/* 3. Slide-out Drawer Dialog */
.glass-drawer {
    background: rgba(255, 255, 255, 0.75) !important;
    backdrop-filter: blur(12px) saturate(180%);
    border-left: 1px solid rgba(0, 0, 0, 0.08) !important;
}
.body--dark .glass-drawer {
    background: rgba(30, 30, 30, 0.75) !important;
    backdrop-filter: blur(12px) saturate(180%);
    border-left: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.freq-bar-container {
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid rgba(0, 0, 0, 0.04);
}
.body--dark .freq-bar-container {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
}

.border-dashed {
    border: 1px dashed rgba(0, 0, 0, 0.08);
}
.body--dark .border-dashed {
    border: 1px dashed rgba(255, 255, 255, 0.08);
}

.dark-bg-grey-9 {
    background: #fafafa;
}
.body--dark .dark-bg-grey-9 {
    background: #1e1e1e;
}

.border-top {
    border-top: 1px solid rgba(0, 0, 0, 0.08);
}
.body--dark .border-top {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.border-bottom {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.body--dark .border-bottom {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.text-ellipsis {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.text-xxs {
    font-size: 0.75rem;
}

.break-all {
    word-break: break-all;
}

/* TransitionGroup Animations */
.node-list-enter-active,
.node-list-leave-active {
    transition: all 0.3s ease;
}
.node-list-enter-from,
.node-list-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}
.node-list-move {
    transition: transform 0.3s ease;
}
</style>
