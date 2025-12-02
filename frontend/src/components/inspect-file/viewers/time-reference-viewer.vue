<template>
    <div class="time-reference-viewer">
        <div class="bg-white rounded-borders border-color">
            <div class="row justify-between items-center q-pa-md border-bottom">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="cyan-1" text-color="cyan-9">
                        {{ messages.length }} events
                    </q-badge>
                    <div class="text-caption text-grey-7">
                        Source: {{ uniqueSources }}
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

            <q-list separator>
                <q-item
                    v-for="(msg, idx) in messages"
                    :key="idx"
                    class="q-py-md"
                >
                    <q-item-section>
                        <div class="row items-center q-mb-sm">
                            <q-badge
                                outline
                                color="primary"
                                :label="msg.data.source || 'Unknown Source'"
                                class="q-mr-sm"
                            />
                            <div class="text-caption text-grey-6 font-mono">
                                Seq: {{ msg.data.header.seq }}
                            </div>
                        </div>

                        <div class="row q-col-gutter-md">
                            <div
                                :class="
                                    hasContext ? 'col-12 col-sm-6' : 'col-12'
                                "
                            >
                                <div
                                    class="text-caption text-weight-bold text-grey-8 q-mb-xs"
                                >
                                    Reference Time (Payload)
                                </div>
                                <div class="bg-cyan-1 q-pa-sm rounded-borders">
                                    <div class="text-body2 text-weight-medium">
                                        {{ formatFullDate(msg.data.time_ref) }}
                                    </div>
                                    <div
                                        class="text-caption text-grey-7 font-mono"
                                    >
                                        {{ msg.data.time_ref.sec }}.{{
                                            String(
                                                msg.data.time_ref.nsec,
                                            ).padStart(9, '0')
                                        }}
                                    </div>
                                </div>
                            </div>

                            <div v-if="hasContext" class="col-12 col-sm-6">
                                <div
                                    class="text-caption text-weight-bold text-grey-8 q-mb-xs"
                                >
                                    Header Stamp (Context)
                                </div>
                                <div class="bg-grey-2 q-pa-sm rounded-borders">
                                    <div class="text-body2 text-grey-9">
                                        {{
                                            formatFullDate(
                                                msg.data.header.stamp,
                                            )
                                        }}
                                    </div>
                                    <div
                                        class="text-caption text-grey-6 font-mono"
                                    >
                                        {{ msg.data.header.stamp.sec }}.{{
                                            String(
                                                msg.data.header.stamp.nsec,
                                            ).padStart(9, '0')
                                        }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </q-item-section>
                </q-item>
            </q-list>

            <div
                v-if="messages.length < totalCount"
                class="text-center q-pa-md bg-grey-1"
            >
                <div class="text-caption text-grey-7 q-mb-xs">
                    Showing {{ messages.length }} / {{ totalCount }} events.
                </div>
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
import { computed, onMounted } from 'vue';

const properties = defineProps<{
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required', 'load-more']);

onMounted(() => {
    if (!properties.messages || properties.messages.length === 0)
        emit('load-required');
});

// --- Computed ---
const uniqueSources = computed(() => {
    const sources = new Set(
        properties.messages.map((m) => m.data.source || 'Unknown'),
    );
    return [...sources].join(', ');
});

const hasContext = computed(() => {
    return properties.messages.some((message) => {
        const stamp = message.data.header?.stamp;
        return stamp && (stamp.sec !== 0 || stamp.nsec !== 0);
    });
});

// --- Formatters ---
const formatFullDate = (timeObject: { sec: number; nsec: number }) => {
    if (!timeObject || (timeObject.sec === 0 && timeObject.nsec === 0))
        return '0 (Not Set)';
    const millis = timeObject.sec * 1000 + timeObject.nsec / 1_000_000;
    return new Date(millis).toISOString().replace('T', ' ').replace('Z', '');
};

async function copyRaw(): Promise<void> {
    await quasarCopy(JSON.stringify(properties.messages, null, 2));
    Notify.create({
        message: 'Data copied',
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
</style>
