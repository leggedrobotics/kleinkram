<template>
    <div class="file-topic-table">
        <div class="flex justify-between items-center q-mb-md">
            <h2 class="text-h4 q-my-none">Messages</h2>
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
                    @click="() => (props.expand = !props.expand)"
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
                                @click.stop="
                                    () => (props.expand = !props.expand)
                                "
                            />
                        </template>

                        <template v-else>
                            {{ col.value }}
                        </template>
                    </q-td>
                </q-tr>

                <q-tr v-show="props.expand" :props="props">
                    <q-td colspan="100%" class="q-pa-none">
                        <div class="q-pa-md bg-grey-1">
                            <MessageViewer
                                :topic-name="props.row.name"
                                :message-type="props.row.type"
                                :total-count="props.row.nrMessages"
                                :messages="previews[props.row.name] || []"
                                :is-loading="
                                    loadingState[props.row.name] || false
                                "
                                :error="topicErrors[props.row.name] || null"
                                :topic-size="props.row.size"
                                :protocol="props.row.protocol"
                                @load-required="() => loadSmart(props.row)"
                                @load-more="() => loadMore(props.row.name)"
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

const properties = defineProps<{
    topics: any[];
    previews: Record<string, any[]>;
    loadingState: Record<string, boolean>;
    topicErrors: Record<string, string | null>;
    isLoading: boolean;
}>();

const emit = defineEmits(['load-preview']);
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

// Directly load specific count (Base function)
const loadData = (topic: string, count: number): void => {
    emit('load-preview', topic, count);
};

// In file-topic-table.vue > script > loadSmart

const loadSmart = (row: any): void => {
    const type = detectPreviewType(row.type);

    // 1. Full Load (Visual Plots / Images)
    if (
        type === PreviewType.IMAGE ||
        type === PreviewType.TWIST ||
        type === PreviewType.TEMPERATURE
    ) {
        loadData(row.name, row.nrMessages);
        return;
    }

    // 2. Medium Load (Logs)
    if (
        type === PreviewType.ROS_LOG ||
        type === PreviewType.TIME_REFERENCE ||
        type === PreviewType.STRING
    ) {
        loadData(row.name, 100);
        return;
    }

    // 3. Strict Load (Heavy Binary)
    if (type === PreviewType.POINT_CLOUD) {
        loadData(row.name, 1);
        return;
    }

    // 4. Default
    loadData(row.name, 5);
};

// Incremental Load (Load More button)
const loadMore = (topicName: string): void => {
    const currentCount = properties.previews[topicName]?.length || 0;
    loadData(topicName, currentCount + 20);
};
</script>
