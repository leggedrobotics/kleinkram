<template>
    <div class="file-topic-table">
        <div class="flex justify-between items-center q-mb-md">
            <h2 class="text-h4 q-my-none flex items-center">
                Messages
                <q-badge
                    color="orange-7"
                    text-color="white"
                    label="BETA"
                    class="text-weight-bold cursor-help q-ml-sm"
                    style="
                        font-size: 10px;
                        padding: 2px 6px;
                        vertical-align: middle;
                    "
                >
                    <q-tooltip>
                        Preview functionality is currently in beta.
                    </q-tooltip>
                </q-badge>
            </h2>
            <app-search-bar v-model="search" placeholder="Search topics..." />
        </div>

        <q-table
            :rows="filteredTopics"
            :columns="columns"
            :loading="isLoading"
            row-key="name"
            flat
            bordered
            :pagination="{ rowsPerPage: 15 }"
        >
            <template #body="props">
                <q-tr
                    :props="props"
                    class="cursor-pointer hover:bg-grey-1"
                    @click="() => toggleExpand(props)"
                >
                    <q-td
                        v-for="col in props.cols"
                        :key="col.name"
                        :props="props"
                        :auto-width="col.name === 'expand'"
                    >
                        <template v-if="col.name === 'expand'">
                            <q-btn
                                round
                                flat
                                dense
                                :icon="
                                    props.expand
                                        ? 'sym_o_expand_less'
                                        : 'sym_o_expand_more'
                                "
                                @click.stop="() => toggleExpand(props)"
                            />
                        </template>

                        <template v-else>
                            {{ col.value }}
                        </template>
                    </q-td>
                </q-tr>

                <q-tr v-if="props.expand" :props="props">
                    <q-td colspan="100%" class="q-pa-none">
                        <div class="q-pa-md">
                            <MessageViewer
                                :topic-name="props.row.name"
                                :message-type="props.row.type"
                                :total-count="
                                    expectedCount(
                                        props.row,
                                        previews[props.row.name]?.length ?? 0,
                                        loadingState[props.row.name] || false,
                                    )
                                "
                                :sample-stride="getSmartLoad(props.row).stride"
                                :messages="previews[props.row.name] || []"
                                :is-loading="
                                    loadingState[props.row.name] || false
                                "
                                :error="topicErrors[props.row.name] || null"
                                :topic-size="props.row.size"
                                :protocol="props.row.protocol"
                                @load-required="() => loadSmart(props.row)"
                                @load-more="() => loadMore(props.row.name)"
                                @pause-preview="
                                    () => emit('pause-preview', props.row.name)
                                "
                            />
                        </div>
                    </q-td>
                </q-tr>
            </template>
        </q-table>
    </div>
</template>

<script setup lang="ts">
import AppSearchBar from 'components/common/app-search-bar.vue';
import type { QTableColumn } from 'quasar';
import { computed, ref } from 'vue';
import { detectPreviewType, PreviewType } from '../../services/message-factory';
import MessageViewer from './message-viewer.vue';

export interface TopicRow {
    name: string;
    type: string;
    nrMessages: number;
    size?: number;
    protocol?: string;
    expand?: boolean;
}

const properties = defineProps<{
    topics: TopicRow[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    previews: Record<string, any[]>;
    loadingState: Record<string, boolean>;
    topicErrors: Record<string, string | null>;
    isLoading: boolean;
}>();

const emit = defineEmits(['load-preview', 'pause-preview', 'resume-preview']);
const search = ref('');

const filteredTopics = computed(() => {
    if (!search.value) return properties.topics;
    const s = search.value.toLowerCase();
    return properties.topics.filter(
        (t) =>
            t.name.toLowerCase().includes(s) ||
            t.type.toLowerCase().includes(s),
    );
});

const columns: QTableColumn[] = [
    {
        name: 'expand',
        label: '',
        field: '',
        align: 'center',
        sortable: false,
    },
    {
        name: 'name',
        label: 'Topic',
        field: 'name',
        align: 'left',
        sortable: true,
    },
    {
        name: 'type',
        label: 'Datatype',
        field: 'type',
        align: 'left',
        sortable: true,
    },
    {
        name: 'count',
        label: 'Messages',
        field: 'nrMessages',
        align: 'right',
        sortable: true,
    },
    {
        name: 'freq',
        label: 'Freq (Hz)',
        field: 'frequency',
        format: (v: number): string => (v ? v.toFixed(1) : '-'),
        align: 'right',
    },
];

interface LoadPlan {
    /** Number of messages to keep in memory */
    limit: number;
    /** Keep only every n-th message (1 = every message) */
    stride: number;
    /** Whether the plan covers the whole topic (possibly sampled) */
    full: boolean;
}

/**
 * Upper bound of messages kept for plot viewers. High-rate topics (e.g. a
 * 400 Hz odometry with >100k messages) are sampled down to this many
 * evenly spaced messages instead of being decoded in full, which would
 * exhaust browser memory.
 */
const MAX_PLOT_MESSAGES = 5000;

const PLOT_TYPES = new Set<PreviewType>([
    PreviewType.TWIST,
    PreviewType.TEMPERATURE,
    PreviewType.IMU,
    PreviewType.STATISTICS,
    PreviewType.ODOMETRY,
    PreviewType.POSE_STAMPED,
    PreviewType.PATH,
    PreviewType.TRANSFORM_STAMPED,
    PreviewType.NAV_SAT_FIX,
    PreviewType.POINT_STAMPED,
]);

const getSmartLoad = (row: TopicRow): LoadPlan => {
    const type = detectPreviewType(row.type);

    if (type === PreviewType.CAMERA_INFO) {
        return { limit: 1, stride: 1, full: false };
    }

    // 1. Full (sampled) Load for plot viewers
    if (PLOT_TYPES.has(type)) {
        const stride = Math.max(
            1,
            Math.ceil(row.nrMessages / MAX_PLOT_MESSAGES),
        );
        return {
            limit: Math.ceil(row.nrMessages / stride),
            stride,
            full: true,
        };
    }

    // 2. Medium Load (Logs)
    if (type === PreviewType.ROS_LOG || type === PreviewType.STRING) {
        return { limit: 100, stride: 1, full: false };
    }

    // 2.5 Sequence Viewer Streaming (Video)
    if (type === PreviewType.IMAGE) {
        return { limit: 1, stride: 1, full: false };
    }

    // 3. Light Load (TimeReference)
    if (type === PreviewType.TIME_REFERENCE) {
        return { limit: 20, stride: 1, full: false };
    }

    // 3. Strict Load (Heavy Binary)
    if (type === PreviewType.POINT_CLOUD || type === PreviewType.GRID_MAP) {
        return { limit: 1, stride: 1, full: false };
    }

    // 4. Default
    return { limit: 5, stride: 1, full: false };
};

/**
 * Number of messages the viewer should expect once loading is done. For
 * sampled plot topics this is the sampled count while loading, and the
 * actual count once loading finished (sampling per chunk can differ from
 * the estimate by a few messages). Otherwise it is the topic size.
 */
const expectedCount = (
    row: TopicRow,
    loadedCount: number,
    isLoading: boolean,
): number => {
    const plan = getSmartLoad(row);
    if (!plan.full) return row.nrMessages;
    if (isLoading || loadedCount === 0) return plan.limit;
    return loadedCount;
};

const toggleExpand = (props: { row: TopicRow; expand: boolean }): void => {
    props.expand = !props.expand;
    if (props.expand) {
        const type = detectPreviewType(props.row.type);
        const hasData =
            properties.previews[props.row.name] &&
            (properties.previews[props.row.name]?.length ?? 0) > 0;

        // Only resume fetching for video/image topics (buffering)
        // For others, only fetch if no data exists (initial load)
        if (type === PreviewType.IMAGE) {
            emit('resume-preview', props.row.name, 50);
            if (!hasData) loadSmart(props.row);
        } else if (!hasData) {
            loadSmart(props.row);
        }
    } else {
        emit('pause-preview', props.row.name);
    }
};

// Directly load specific count (Base function)
const loadData = (
    topic: string,
    count: number,
    append = false,
    stride = 1,
    progressive = false,
): void => {
    emit('load-preview', topic, {
        limit: count,
        append,
        stride,
        progressive,
    });
};

const loadSmart = (row: TopicRow): void => {
    const plan = getSmartLoad(row);
    // Plot viewers show the whole recording: load it coarse-to-fine so the
    // full time range is visible early and refines as data streams in.
    loadData(row.name, plan.limit, false, plan.stride, plan.full);
};

// Incremental Load (Load More button)
const loadMore = (topicName: string): void => {
    // If it's an image stream, load a larger background buffer, else default back to 20
    const t = properties.topics.find((x) => x.name === topicName);
    const type = t ? detectPreviewType(t.type) : PreviewType.STRING;
    const limit = type === PreviewType.IMAGE ? 50 : 20;
    loadData(topicName, limit, true);
};
</script>
