<template>
    <div class="file-topic-table">
        <div
            class="flex justify-between items-center q-mb-md file-topic-table__head"
        >
            <h2 class="text-h5 text-md-h4 q-my-none flex items-center">
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
            <app-search-bar
                v-model="search"
                placeholder="Search topics..."
                class="file-topic-table__search"
            />
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
                                :aria-label="
                                    props.expand
                                        ? 'Collapse topic preview'
                                        : 'Expand topic preview'
                                "
                                :icon="
                                    props.expand
                                        ? 'sym_o_expand_less'
                                        : 'sym_o_expand_more'
                                "
                                @click.stop="() => toggleExpand(props)"
                            />
                        </template>

                        <template v-else-if="col.name === 'name'">
                            <div class="topic-name">{{ col.value }}</div>
                            <div
                                v-if="$q.screen.xs"
                                class="text-caption text-grey-7 topic-name"
                            >
                                {{ props.row.type }}
                            </div>
                        </template>

                        <template v-else>
                            {{ col.value }}
                        </template>
                    </q-td>
                </q-tr>

                <q-tr v-if="props.expand" :props="props">
                    <q-td colspan="100%" class="q-pa-none">
                        <div class="q-pa-md topic-expanded">
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
                                :can-refine="canRefineImage(props.row)"
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
import { useQuasar } from 'quasar';
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
const $q = useQuasar();
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

const allColumns: QTableColumn[] = [
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

/**
 * Phones only have room for the topic and the message count; the datatype
 * is shown as a caption below the topic name instead of in its own column.
 */
const HIDDEN_COLUMNS_ON_PHONES = new Set(['type', 'freq']);

const columns = computed<QTableColumn[]>(() =>
    $q.screen.xs
        ? allColumns.filter(
              (column) => !HIDDEN_COLUMNS_ON_PHONES.has(column.name),
          )
        : allColumns,
);

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

/**
 * Image streams are shown as a sampled sequence covering the whole
 * recording. The initial sample is bounded by a frame count and by a byte
 * budget (raw images can be several MB each); "Load more frames" halves
 * the sampling step, up to a hard frame cap.
 */
const INITIAL_IMAGE_FRAMES = 120;
const MAX_IMAGE_FRAMES = 2000;
const IMAGE_BYTE_BUDGET = 400 * 1024 * 1024;

/** Refinement level per image topic: each level halves the stride. */
const imageRefinement = ref<Record<string, number>>({});

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

/**
 * Bytes per frame of an image topic: from the topic size when the API
 * provides it, otherwise measured on the frames loaded so far (the first
 * sample is small, so its measurement bounds every refinement).
 */
const bytesPerImageFrame = (row: TopicRow): number => {
    if (row.size !== undefined && row.size > 0 && row.nrMessages > 0) {
        return row.size / row.nrMessages;
    }
    const loaded = properties.previews[row.name] ?? [];
    if (loaded.length === 0) return 0;
    let bytes = 0;
    let counted = 0;
    for (const message of loaded) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const payload = message?.data?.data;
        if (payload instanceof Uint8Array) {
            bytes += payload.byteLength;
            counted++;
        } else if (Array.isArray(payload)) {
            bytes += payload.length;
            counted++;
        }
    }
    return counted > 0 ? bytes / counted : 0;
};

const imageStrideForLevel = (row: TopicRow, level: number): number => {
    const bytesPerFrame = bytesPerImageFrame(row);
    const framesWithinBudget =
        bytesPerFrame > 0
            ? Math.floor(IMAGE_BYTE_BUDGET / bytesPerFrame)
            : MAX_IMAGE_FRAMES;
    const targetFrames = Math.max(
        1,
        Math.min(
            MAX_IMAGE_FRAMES,
            framesWithinBudget,
            INITIAL_IMAGE_FRAMES * 2 ** level,
        ),
    );
    return Math.max(1, Math.ceil(row.nrMessages / targetFrames));
};

const getImageLoad = (row: TopicRow): LoadPlan => {
    const stride = imageStrideForLevel(
        row,
        imageRefinement.value[row.name] ?? 0,
    );
    return { limit: Math.ceil(row.nrMessages / stride), stride, full: true };
};

/** Whether an image topic can still be refined with a smaller stride. */
const canRefineImage = (row: TopicRow): boolean => {
    const level = imageRefinement.value[row.name] ?? 0;
    return (
        imageStrideForLevel(row, level + 1) < imageStrideForLevel(row, level)
    );
};

const getSmartLoad = (row: TopicRow): LoadPlan => {
    const type = detectPreviewType(row.type);

    if (type === PreviewType.CAMERA_INFO) {
        return { limit: 1, stride: 1, full: false };
    }

    // 0. Sampled sequence covering the whole recording (video)
    if (type === PreviewType.IMAGE) {
        return getImageLoad(row);
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
        const hasData =
            properties.previews[props.row.name] &&
            (properties.previews[props.row.name]?.length ?? 0) > 0;

        // Only fetch if no data exists (initial load). Sampled sequences
        // (images, plots) stay in memory while collapsed.
        if (!hasData) loadSmart(props.row);
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
    const row = properties.topics.find((x) => x.name === topic);
    emit('load-preview', topic, {
        limit: count,
        append,
        stride,
        progressive,
        totalMessages: row?.nrMessages,
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
    const row = properties.topics.find((x) => x.name === topicName);
    const type = row ? detectPreviewType(row.type) : PreviewType.STRING;

    // Image streams: refine the sampled sequence with a smaller stride,
    // keeping the frames already loaded.
    if (row && type === PreviewType.IMAGE) {
        if (!canRefineImage(row)) return;
        imageRefinement.value[row.name] =
            (imageRefinement.value[row.name] ?? 0) + 1;
        const plan = getImageLoad(row);
        emit('load-preview', row.name, {
            limit: plan.limit,
            append: false,
            stride: plan.stride,
            progressive: true,
            merge: true,
            totalMessages: row.nrMessages,
        });
        return;
    }

    loadData(topicName, 20, true);
};
</script>

<style scoped>
.file-topic-table {
    max-width: 100%;
}

/* Long topic names wrap instead of widening the table */
.topic-name {
    overflow-wrap: anywhere;
}

@media (max-width: 599px) {
    /* Title and search bar stack, the search bar takes the full width */
    .file-topic-table__head {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
    }

    .file-topic-table__search {
        width: 100%;
    }

    /* The expanded preview gets the full width of the table */
    .topic-expanded {
        min-width: 0;
        padding: 8px 4px;
    }

    /* The topic column takes the remaining width; breaking anywhere keeps
       its minimum width tiny so the table can shrink to the phone width */
    :deep(.q-table) {
        width: 100%;
    }

    :deep(.q-table th:first-child),
    :deep(.q-table td:first-child:not([colspan])) {
        width: 44px;
        padding-left: 4px;
        padding-right: 4px;
    }

    :deep(.q-table th:nth-child(2)),
    :deep(.q-table td:nth-child(2)) {
        width: 100%;
        min-width: 0;
        white-space: normal;
        overflow-wrap: anywhere;
    }

    :deep(.q-table th:last-child),
    :deep(.q-table td:last-child:not([colspan])) {
        white-space: nowrap;
        text-align: right;
    }

    .topic-name {
        overflow-wrap: anywhere;
    }
}
</style>
