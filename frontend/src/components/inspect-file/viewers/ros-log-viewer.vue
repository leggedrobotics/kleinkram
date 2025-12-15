<template>
    <div class="ros-log-viewer">
        <div class="bg-white rounded-borders border-color">
            <div class="row justify-between items-center q-pa-md border-bottom">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="blue-grey-1" text-color="blue-grey-9">
                        {{ messages.length }} logs
                    </q-badge>
                    <div class="text-caption text-grey-7">
                        Showing first {{ messages.length }} entries
                    </div>
                </div>
                <q-btn
                    icon="sym_o_content_copy"
                    flat
                    round
                    dense
                    size="sm"
                    color="grey-7"
                    @click="copyRaw"
                >
                    <q-tooltip>Copy JSON</q-tooltip>
                </q-btn>
            </div>

            <div
                class="q-pa-sm bg-grey-1 rounded-borders"
                style="max-height: 500px; overflow-y: auto"
            >
                <div
                    v-for="(msg, idx) in messages"
                    :key="idx"
                    class="row no-wrap items-baseline q-py-xs"
                    style="font-family: monospace; font-size: 0.8em"
                >
                    <!-- Time -->
                    <span class="text-grey-7 q-mr-sm" style="min-width: 140px">
                        [{{ formatTime(msg.logTime) }}]
                    </span>

                    <!-- Level -->
                    <span
                        class="text-weight-bold q-mr-sm"
                        :class="getLevelClass(msg.data.level)"
                        style="min-width: 50px"
                    >
                        [{{ getLevelLabel(msg.data.level) }}]
                    </span>

                    <!-- Node -->
                    <span class="text-grey-9 q-mr-sm text-weight-medium">
                        [{{ msg.data.name }}]
                    </span>

                    <!-- Message -->
                    <span class="text-grey-10 break-word col">
                        {{ msg.data.msg }}
                    </span>
                </div>
            </div>

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
import { Notify, copyToClipboard as quasarCopy } from 'quasar';
import { onMounted } from 'vue';
import SmoothLoading from '../../common/smooth-loading.vue';

const properties = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required', 'load-more']);

onMounted(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!properties.messages || properties.messages.length === 0)
        emit('load-required');
});

// --- Helpers ---
const formatTime = (nano: bigint): string => {
    const ms = Number(nano / 1_000_000n);
    const date = new Date(ms);

    if (Number.isNaN(date.getTime())) {
        return 'Invalid Time';
    }

    const timePart = date.toISOString().split('T')[1];
    return timePart?.replace('Z', '') ?? 'Invalid Time';
};

// ROS Log Levels: 1=Debug, 2=Info, 4=Warn, 8=Error, 16=Fatal
const getLevelClass = (level: number): string => {
    switch (level) {
        case 1:
        case 2: {
            return 'text-grey-7';
        } // DEBUG, INFO
        case 4: {
            return 'text-orange-9';
        } // WARN
        case 8:
        case 16: {
            return 'text-negative';
        } // ERROR, FATAL
        default: {
            return 'text-grey-8';
        }
    }
};

const getLevelLabel = (level: number): string => {
    switch (level) {
        case 1: {
            return 'DEBUG';
        }
        case 2: {
            return 'INFO';
        }
        case 4: {
            return 'WARN';
        }
        case 8: {
            return 'ERROR';
        }
        case 16: {
            return 'FATAL';
        }
        default: {
            return 'UNK';
        }
    }
};

async function copyRaw(): Promise<void> {
    await quasarCopy(JSON.stringify(properties.messages, null, 2));
    Notify.create({
        message: 'Logs copied',
        color: 'positive',
        timeout: 1000,
    });
}

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
.font-mono {
    font-family: 'Roboto Mono', monospace;
}
.break-word {
    word-wrap: break-word;
    white-space: pre-wrap;
}
.hover-bg:hover {
    background-color: #fafafa;
}
</style>
