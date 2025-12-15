<template>
    <div class="tf-log-viewer">
        <q-list separator class="bg-white rounded-borders border-color">
            <q-item
                v-for="(msg, idx) in messages"
                :key="idx"
                class="q-py-md items-start column"
            >
                <div class="row items-center q-mb-sm full-width">
                    <div class="row items-center">
                        <q-badge color="grey-3" text-color="black">
                            <q-icon
                                name="sym_o_schedule"
                                size="xs"
                                class="q-mr-xs"
                            />
                            {{ formatTime(msg.logTime) }}
                        </q-badge>
                        <div class="text-caption text-grey-6 q-ml-sm">
                            {{ msg.data?.transforms?.length || 0 }} transform(s)
                        </div>
                    </div>

                    <q-space />

                    <q-btn
                        icon="sym_o_content_copy"
                        flat
                        round
                        dense
                        size="sm"
                        color="grey-7"
                        @click="() => copyRaw(msg.data)"
                    >
                        <q-tooltip>Copy raw JSON</q-tooltip>
                    </q-btn>
                </div>

                <div class="full-width q-gutter-y-sm">
                    <div
                        v-for="(tf, tfIdx) in (msg.data.transforms || []).slice(
                            0,
                            5,
                        )"
                        :key="tfIdx"
                        class="bg-grey-1 rounded-borders q-pa-sm"
                    >
                        <div class="row items-center q-mb-xs">
                            <span
                                class="text-weight-bold text-primary bg-blue-1 q-px-sm rounded-borders"
                            >
                                {{ tf.header.frame_id }}
                            </span>
                            <q-icon
                                name="sym_o_arrow_right_alt"
                                class="q-mx-sm text-grey-7"
                                size="sm"
                            />
                            <span
                                class="text-weight-bold text-secondary bg-teal-1 q-px-sm rounded-borders"
                            >
                                {{ tf.child_frame_id }}
                            </span>
                        </div>

                        <div class="row q-col-gutter-sm text-caption font-mono">
                            <div class="col-12 col-sm-6">
                                <div
                                    class="text-grey-8 text-weight-medium q-mb-xs"
                                >
                                    Translation
                                </div>
                                <div class="row q-gutter-x-md">
                                    <span
                                        >x:
                                        {{
                                            fmt(tf.transform?.translation?.x)
                                        }}</span
                                    >
                                    <span
                                        >y:
                                        {{
                                            fmt(tf.transform?.translation?.y)
                                        }}</span
                                    >
                                    <span
                                        >z:
                                        {{
                                            fmt(tf.transform?.translation?.z)
                                        }}</span
                                    >
                                </div>
                            </div>

                            <div class="col-12 col-sm-6">
                                <div
                                    class="text-grey-8 text-weight-medium q-mb-xs"
                                >
                                    Rotation (Quaternion)
                                </div>
                                <div class="row q-gutter-x-md">
                                    <span
                                        >x:
                                        {{
                                            fmt(tf.transform?.rotation?.x)
                                        }}</span
                                    >
                                    <span
                                        >y:
                                        {{
                                            fmt(tf.transform?.rotation?.y)
                                        }}</span
                                    >
                                    <span
                                        >z:
                                        {{
                                            fmt(tf.transform?.rotation?.z)
                                        }}</span
                                    >
                                    <span
                                        >w:
                                        {{
                                            fmt(tf.transform?.rotation?.w)
                                        }}</span
                                    >
                                </div>
                            </div>
                        </div>
                    </div>
                    <div
                        v-if="(msg.data.transforms || []).length > 5"
                        class="text-center text-caption text-grey-7 q-pa-xs bg-grey-2 rounded-borders"
                    >
                        + {{ msg.data.transforms.length - 5 }} more transforms
                    </div>
                </div>
            </q-item>

            <q-item
                v-if="messages.length < totalCount"
                class="q-py-md bg-grey-1 text-center"
            >
                <q-item-section>
                    <div class="row justify-center items-center q-gutter-sm">
                        <div class="text-caption text-grey-7">
                            <q-icon
                                name="sym_o_info"
                                size="xs"
                                class="q-mr-xs"
                            />
                            Showing first {{ messages.length }} messages.
                            <span class="text-weight-bold">
                                {{ totalCount - messages.length }} additional
                            </span>
                            available.
                        </div>
                        <q-btn
                            label="Load more"
                            icon="sym_o_download"
                            size="sm"
                            flat
                            color="primary"
                            dense
                            @click="loadMore"
                        />
                    </div>
                </q-item-section>
            </q-item>
        </q-list>
    </div>
</template>

<script setup lang="ts">
import { Notify, copyToClipboard as quasarCopy } from 'quasar';
import { onMounted } from 'vue';

const properties = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required', 'load-more']);

onMounted(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!properties.messages || properties.messages.length === 0) {
        emit('load-required');
    }
});

const formatTime = (nano: bigint): string => {
    const ms = Number(nano / 1_000_000n);
    const date = new Date(ms);

    if (Number.isNaN(date.getTime())) {
        return 'Invalid Time';
    }

    const timePart = date.toISOString().split('T')[1];
    return timePart?.replace('Z', '') ?? 'Invalid Time';
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const fmt = (number_: number | undefined): string => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (number_ === undefined || number_ === null) return '0.00';
    return number_.toFixed(4);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function copyRaw(data: any): Promise<void> {
    await quasarCopy(JSON.stringify(data, null, 2));
    Notify.create({
        message: 'Payload copied',
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
.font-mono {
    font-family: 'Roboto Mono', monospace;
}
</style>
