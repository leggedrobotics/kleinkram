<template>
    <div class="nav-sat-fix-viewer">
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
                    <div class="text-caption text-grey-7">Latitude</div>
                    <div class="text-h6">
                        {{ latestMessage.latitude.toFixed(6) }}°
                    </div>
                </div>
                <div class="col-12 col-md-4">
                    <div class="text-caption text-grey-7">Longitude</div>
                    <div class="text-h6">
                        {{ latestMessage.longitude.toFixed(6) }}°
                    </div>
                </div>
                <div class="col-12 col-md-4">
                    <div class="text-caption text-grey-7">Altitude</div>
                    <div class="text-h6">
                        {{ latestMessage.altitude.toFixed(2) }}m
                    </div>
                </div>
                <div class="col-12">
                    <div class="text-caption text-grey-7">Status</div>
                    <div>
                        <q-chip
                            :color="statusColor"
                            text-color="white"
                            size="sm"
                            class="q-ma-none"
                        >
                            {{ statusText }}
                        </q-chip>
                        <span class="text-grey-6 q-ml-sm text-caption">
                            Service: {{ latestMessage.status.service }}
                        </span>
                    </div>
                </div>
                <div class="col-12">
                    <div class="text-caption text-grey-7">
                        Position Covariance Type
                    </div>
                    <div>{{ covarianceType }}</div>
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

const statusText = computed(() => {
    if (!latestMessage.value) return 'Unknown';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const status = latestMessage.value.status.status;
    switch (status) {
        case -1: {
            return 'NO_FIX';
        }
        case 0: {
            return 'FIX';
        }
        case 1: {
            return 'SBAS_FIX';
        }
        case 2: {
            return 'GBAS_FIX';
        }
        default: {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            return `Unknown (${status})`;
        }
    }
});

const statusColor = computed(() => {
    if (!latestMessage.value) return 'grey';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const status = latestMessage.value.status.status;
    switch (status) {
        case -1: {
            return 'red';
        }
        case 0: {
            return 'green';
        }
        case 1: {
            return 'blue';
        }
        case 2: {
            return 'purple';
        }
        default: {
            return 'grey';
        }
    }
});

const covarianceType = computed(() => {
    if (!latestMessage.value) return 'Unknown';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const type = latestMessage.value.position_covariance_type;
    switch (type) {
        case 0: {
            return 'UNKNOWN';
        }
        case 1: {
            return 'APPROXIMATED';
        }
        case 2: {
            return 'DIAGONAL_KNOWN';
        }
        case 3: {
            return 'KNOWN';
        }
        default: {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            return `Unknown (${type})`;
        }
    }
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
