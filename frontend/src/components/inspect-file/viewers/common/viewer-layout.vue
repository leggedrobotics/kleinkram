<template>
    <div class="viewer-layout">
        <div
            class="bg-white rounded-borders border-color q-pa-md transition-generic"
        >
            <div class="row justify-between items-center q-mb-md">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="blue-3" text-color="blue-9">
                        <q-icon
                            name="sym_o_timeline"
                            size="xs"
                            class="q-mr-xs"
                        />
                        {{ duration.toFixed(2) }}s
                    </q-badge>
                    <q-badge color="blue-1" text-color="blue-9">
                        {{ messages.length }} Messages
                    </q-badge>
                    <q-spinner-dots
                        v-if="isLoading"
                        color="primary"
                        size="1em"
                    />

                    <slot name="header-extra"></slot>
                </div>

                <div class="row items-center q-gutter-x-sm">
                    <slot name="header-actions"></slot>

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
            </div>

            <div
                v-if="messages.length === 0 && isLoading"
                class="row q-col-gutter-md"
            >
                <div class="col-12">
                    <div
                        class="skeleton-graph rounded-borders overflow-hidden relative-position"
                        style="height: 200px; border: 1px solid #eee"
                    >
                        <div class="absolute-full flex flex-center text-grey-4">
                            <q-spinner color="primary" size="2em" />
                        </div>
                    </div>
                </div>
            </div>

            <div
                v-else-if="messages.length === 0"
                class="text-center text-grey-5 q-pa-lg"
            >
                No data available
            </div>

            <div v-else class="content-wrapper">
                <slot></slot>
            </div>

            <div v-if="$slots.footer" class="q-mt-md">
                <slot name="footer"></slot>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Notify, copyToClipboard as quasarCopy } from 'quasar';
import { computed } from 'vue';

const props = defineProps<{
    messages: any[];
    totalCount: number;
    isLoading?: boolean;
    title?: string;
}>();

const duration = computed(() => {
    if (props.messages.length < 2) return 0;
    const start = props.messages[0].logTime;
    const end = props.messages.at(-1).logTime;
    return Number(end - start) / 1_000_000_000;
});

// Helper to handle BigInt serialization
const replacer = (_key: string, value: any) => {
    if (typeof value === 'bigint') {
        return value.toString();
    }
    return value;
};

async function copyRaw(): Promise<void> {
    if (props.messages.length === 0) return;
    // Copy latest message by default, or maybe all?
    // The existing viewers mostly copy the latest message or the whole array.
    // Let's copy the latest message for now as a default, but maybe we should expose this?
    // Actually, twist-viewer copies ALL messages, others copy LATEST.
    // Let's default to latest, but maybe we need a prop or just let the parent handle it?
    // To make it truly shared, maybe we should emit an event?
    // But for now, let's implement a smart default: if > 1 message, copy latest?
    // Or just copy the last one.

    const last = props.messages.at(-1);
    const dataToCopy = last.data === undefined ? last : last.data;

    await quasarCopy(JSON.stringify(dataToCopy, replacer, 2));
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
