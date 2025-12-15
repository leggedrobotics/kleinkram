<template>
    <div class="point-stamped-viewer">
        <div class="bg-white rounded-borders border-color q-pa-md">
            <div class="row items-center q-mb-md q-gutter-x-sm">
                <q-badge color="blue-3" text-color="blue-9">
                    <q-icon name="sym_o_timeline" size="xs" class="q-mr-xs" />
                    {{ duration.toFixed(2) }}s
                </q-badge>
                <q-badge color="blue-1" text-color="blue-9">
                    {{ messages.length }} Messages
                </q-badge>
                <q-spinner-dots v-if="isLoading" color="primary" size="1em" />
                <q-space />
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

            <div v-if="latestMessage" class="row q-col-gutter-md">
                <div class="col-12 col-md-4">
                    <div class="text-caption text-grey-7">X</div>
                    <div class="text-h6">
                        {{ latestMessage.point.x.toFixed(6) }}
                    </div>
                </div>
                <div class="col-12 col-md-4">
                    <div class="text-caption text-grey-7">Y</div>
                    <div class="text-h6">
                        {{ latestMessage.point.y.toFixed(6) }}
                    </div>
                </div>
                <div class="col-12 col-md-4">
                    <div class="text-caption text-grey-7">Z</div>
                    <div class="text-h6">
                        {{ latestMessage.point.z.toFixed(6) }}
                    </div>
                </div>
                <div class="col-12">
                    <div class="text-caption text-grey-7">Frame ID</div>
                    <div>
                        <q-badge color="grey-3" text-color="black">
                            {{ latestMessage.header.frame_id }}
                        </q-badge>
                    </div>
                </div>
            </div>
            <div v-else class="text-center text-grey-5 q-pa-lg">
                No data available
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Notify, copyToClipboard as quasarCopy } from 'quasar';
import { computed } from 'vue';

const properties = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const isLoading = computed(
    () => properties.messages.length < properties.totalCount,
);

const duration = computed(() => {
    if (properties.messages.length < 2) return 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const start = properties.messages[0].logTime;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const end = properties.messages.at(-1).logTime;
    return Number(end - start) / 1_000_000_000;
});

const latestMessage = computed(() => {
    if (properties.messages.length === 0) return null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return properties.messages.at(-1).data;
});

async function copyRaw(): Promise<void> {
    if (!latestMessage.value) return;
    await quasarCopy(JSON.stringify(latestMessage.value, null, 2));
    Notify.create({
        message: 'Latest message copied',
        color: 'positive',
        timeout: 1000,
    });
}
</script>

<style scoped>
.border-color {
    border: 1px solid #e0e0e0;
}
</style>
