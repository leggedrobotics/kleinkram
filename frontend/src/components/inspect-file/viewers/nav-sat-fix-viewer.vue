<template>
    <ViewerLayout
        :messages="messages"
        :total-count="totalCount"
        :is-loading="isLoading"
    >
        <template #header-extra>
            <q-badge v-if="latest" :color="statusColor" text-color="white">
                {{ statusText }}
            </q-badge>
            <q-badge v-if="trackLength > 0" color="grey-2" text-color="grey-9">
                <q-icon name="sym_o_route" size="xs" class="q-mr-xs" />
                {{ formatDistance(trackLength) }}
            </q-badge>
            <q-badge
                v-if="droppedCount > 0"
                color="orange-1"
                text-color="orange-10"
                class="cursor-help"
            >
                {{ droppedCount }} without position
                <q-tooltip>
                    {{ droppedCount }} messages report no position (all-zero or
                    invalid coordinates) and are not plotted.
                </q-tooltip>
            </q-badge>
        </template>

        <div class="row q-col-gutter-md">
            <div class="col-12">
                <TrackMap :points="track" :height="340" />
            </div>

            <div v-if="latest" class="col-12">
                <div class="row q-col-gutter-md">
                    <div class="col-6 col-md-3">
                        <div class="text-caption text-grey-7">Latitude</div>
                        <div class="text-subtitle1 text-weight-medium">
                            {{ formatCoordinate(latest.latitude, 6) }}°
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="text-caption text-grey-7">Longitude</div>
                        <div class="text-subtitle1 text-weight-medium">
                            {{ formatCoordinate(latest.longitude, 6) }}°
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="text-caption text-grey-7">Altitude</div>
                        <div class="text-subtitle1 text-weight-medium">
                            {{ formatCoordinate(latest.altitude, 2) }} m
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="text-caption text-grey-7">Covariance</div>
                        <div class="text-subtitle1 text-weight-medium">
                            {{ covarianceType }}
                        </div>
                        <div class="text-caption text-grey-6">
                            Service: {{ serviceText }}
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-12">
                <SimpleTimeChart
                    title="Altitude (m)"
                    :series="altitudeSeries"
                    y-axis-label="m"
                    :height="160"
                    :start-time="startTime"
                />
            </div>

            <div v-if="statusCounts.length > 1" class="col-12">
                <div class="text-caption text-grey-7 q-mb-xs">
                    Fix status over the recording
                </div>
                <div class="row q-gutter-x-sm">
                    <q-badge
                        v-for="entry in statusCounts"
                        :key="entry.status"
                        :color="statusColorFor(entry.status)"
                        text-color="white"
                    >
                        {{ statusTextFor(entry.status) }}: {{ entry.count }}
                    </q-badge>
                </div>
            </div>
        </div>
    </ViewerLayout>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { GeoPoint, trackLengthMetres } from './common/geo';
import TrackMap from './common/track-map.vue';
import { BaseMessage, useViewer } from './common/use-viewer';
import ViewerLayout from './common/viewer-layout.vue';
import SimpleTimeChart, { ChartSeries } from './simple-time-chart.vue';

interface NavSatFixData {
    latitude?: number;
    longitude?: number;
    altitude?: number;
    status?: { status?: number; service?: number };
    // eslint-disable-next-line @typescript-eslint/naming-convention
    position_covariance_type?: number;
}

interface NavSatFixMessage extends BaseMessage {
    data?: NavSatFixData;
}

const properties = defineProps<{
    messages: NavSatFixMessage[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required']);

onMounted(() => {
    if (properties.messages.length === 0) emit('load-required');
});

const { startTime, getNormalizedTime } = useViewer(() => properties.messages);

const isLoading = computed(
    () => properties.messages.length < properties.totalCount,
);

/**
 * Receivers without a fix report all-zero coordinates (or NaN). Those
 * samples carry no position information and are excluded from the map,
 * the altitude chart and the coordinate display.
 */
const hasValidPosition = (data: NavSatFixData | undefined): boolean =>
    data !== undefined &&
    typeof data.latitude === 'number' &&
    typeof data.longitude === 'number' &&
    Number.isFinite(data.latitude) &&
    Number.isFinite(data.longitude) &&
    !(data.latitude === 0 && data.longitude === 0);

const validMessages = computed(() =>
    properties.messages.filter((message) => hasValidPosition(message.data)),
);

const latest = computed(
    () => validMessages.value.at(-1)?.data ?? properties.messages.at(-1)?.data,
);

const track = computed<GeoPoint[]>(() =>
    validMessages.value.map((message) => ({
        lat: message.data?.latitude ?? 0,
        lon: message.data?.longitude ?? 0,
    })),
);

const trackLength = computed(() => trackLengthMetres(track.value));

const droppedCount = computed(
    () => properties.messages.length - validMessages.value.length,
);

const formatDistance = (metres: number): string =>
    metres >= 1000
        ? `${(metres / 1000).toFixed(2)} km`
        : `${metres.toFixed(0)} m`;

const formatCoordinate = (value: number | undefined, digits: number): string =>
    typeof value === 'number' && Number.isFinite(value)
        ? value.toFixed(digits)
        : '-';

const altitudeSeries = computed<ChartSeries[]>(() => {
    const data: { time: number; value: number }[] = [];
    for (const message of validMessages.value) {
        const altitude = message.data?.altitude;
        // An exact 0 altitude is a placeholder from receivers without a fix
        if (
            typeof altitude !== 'number' ||
            !Number.isFinite(altitude) ||
            altitude === 0
        ) {
            continue;
        }
        data.push({
            time: getNormalizedTime(message.logTime),
            value: altitude,
        });
    }
    return [{ name: 'Altitude', color: '#2196F3', data }];
});

// --- Status decoding (sensor_msgs/NavSatStatus) ---
const statusTextFor = (status: number | undefined): string => {
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
            return status === undefined
                ? 'Unknown'
                : `Unknown (${String(status)})`;
        }
    }
};

const statusColorFor = (status: number | undefined): string => {
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
};

const statusText = computed(() => statusTextFor(latest.value?.status?.status));
const statusColor = computed(() =>
    statusColorFor(latest.value?.status?.status),
);

const serviceText = computed(() => {
    const service = latest.value?.status?.service;
    if (service === undefined) return '-';
    const names: string[] = [];
    if (service & 1) names.push('GPS');
    if (service & 2) names.push('GLONASS');
    if (service & 4) names.push('COMPASS');
    if (service & 8) names.push('GALILEO');
    return names.length > 0 ? names.join(', ') : String(service);
});

const covarianceType = computed(() => {
    switch (latest.value?.position_covariance_type) {
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
            return '-';
        }
    }
});

const statusCounts = computed(() => {
    const counts = new Map<number, number>();
    for (const message of properties.messages) {
        const status = message.data?.status?.status;
        if (status === undefined) continue;
        counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([status, count]) => ({ status, count }))
        .toSorted((a, b) => b.count - a.count);
});
</script>
