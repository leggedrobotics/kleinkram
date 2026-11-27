<template>
    <div class="novatel-log-viewer">
        <div
            v-if="summary === undefined && !failed"
            class="row items-center q-gutter-sm text-grey-7"
        >
            <q-spinner-dots size="1.5em" /> <span>Reading receiver log...</span>
        </div>

        <div v-else-if="failed || !summary" class="text-negative">
            <q-icon name="sym_o_warning" /> The receiver log could not be read.
        </div>

        <template v-else>
            <div class="facts row bg-white rounded-borders q-mb-lg">
                <div class="facts__item col-12 col-sm-6 col-md">
                    <div class="facts__label">Receiver</div>
                    <div class="facts__value ellipsis">
                        NovAtel {{ hardwareName }}
                    </div>
                    <div class="text-caption text-grey-7 ellipsis">
                        <template v-if="summary.receiver">
                            {{ summary.receiver.firmware }} · S/N
                            {{ summary.receiver.serial }}
                        </template>
                        <template v-else>No VERSION log</template>
                    </div>
                </div>

                <div class="facts__item col-12 col-sm-6 col-md">
                    <div class="facts__label">Recorded</div>
                    <div class="facts__value">
                        {{ span ? formatSpan(span.seconds) : 'No GPS time' }}
                    </div>
                    <div v-if="span" class="text-caption text-grey-7">
                        {{ formatDate(span.start, true).slice(0, 19) }} –
                        {{ clock(span.end) }}
                    </div>
                </div>

                <div
                    v-if="summary.latest"
                    class="facts__item col-12 col-sm-6 col-md"
                >
                    <div class="facts__label">Solution</div>
                    <div class="facts__value ellipsis">
                        {{ summary.latest.positionType }}
                    </div>
                    <div class="text-caption text-grey-7 ellipsis">
                        {{
                            [
                                summary.latest.insStatus,
                                sigmaLabel(summary.latest.horizontalSigma),
                            ]
                                .filter(Boolean)
                                .join(' · ')
                        }}
                    </div>
                </div>

                <div class="facts__item col-12 col-sm-6 col-md">
                    <div class="facts__label">Messages</div>
                    <div class="facts__value">
                        {{ formatCount(summary.messageCount) }} ·
                        {{ summary.messages.length }} types
                    </div>
                    <div class="text-caption text-grey-7">
                        <template v-if="summary.truncated">
                            in the first
                            {{ formatSize(summary.scannedBytes) }} of
                            {{ formatSize(size) }}
                        </template>
                        <template v-else>whole file</template>
                    </div>
                </div>
            </div>

            <div class="row q-col-gutter-lg">
                <div v-if="summary.track.length > 0" class="col-12 col-md-7">
                    <TrackMap :points="summary.track" :height="360" />
                    <div class="text-caption text-grey-7 q-mt-xs">
                        {{ summary.trackSource }} ·
                        {{ formatCoordinate(summary.track[0]?.lat) }},
                        {{ formatCoordinate(summary.track[0]?.lon) }}
                        <template v-if="trackLength > 0">
                            · {{ formatDistance(trackLength) }}
                        </template>
                        <template v-if="summary.truncated">
                            · sampled across the file
                        </template>
                    </div>
                </div>

                <div
                    class="col-12"
                    :class="{ 'col-md-5': summary.track.length > 0 }"
                >
                    <q-table
                        flat
                        bordered
                        dense
                        :rows="summary.messages"
                        :columns="columns"
                        :row-key="
                            (row: NovatelMessageStats) =>
                                `${row.framing}:${row.name}`
                        "
                        :pagination="{ rowsPerPage: 0 }"
                        hide-pagination
                        class="message-table"
                    >
                        <template #body-cell-name="cellProperties">
                            <q-td :props="cellProperties" class="text-mono">
                                {{ cellProperties.value }}
                            </q-td>
                        </template>
                        <template #body-cell-framing="cellProperties">
                            <q-td :props="cellProperties">
                                <q-badge
                                    :color="
                                        isBinary(cellProperties.row)
                                            ? 'blue-1'
                                            : 'grey-3'
                                    "
                                    :text-color="
                                        isBinary(cellProperties.row)
                                            ? 'blue-9'
                                            : 'grey-9'
                                    "
                                    :label="cellProperties.value"
                                />
                            </q-td>
                        </template>
                    </q-table>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import type { QTableColumn } from 'quasar';
import { formatDate } from 'src/services/date-formating';
import { formatSize as formatSizeWithUnit } from 'src/services/general-formatting';
import {
    loadNovatelSummary,
    NovatelMessageStats,
    NovatelSummary,
} from 'src/services/log-preview';
import { computed, ref, watch } from 'vue';
import { trackLengthMetres } from './common/geo';
import TrackMap from './common/track-map.vue';

const properties = defineProps<{
    url: string;
    size: number;
}>();

const summary = ref<NovatelSummary | undefined>(undefined);
const failed = ref(false);

watch(
    () => properties.url,
    async (url) => {
        summary.value = undefined;
        failed.value = false;
        try {
            const loaded = await loadNovatelSummary(url, properties.size);
            if (url !== properties.url) return;
            summary.value = loaded;
            failed.value = loaded === undefined;
        } catch (error) {
            console.error(error);
            if (url === properties.url) failed.value = true;
        }
    },
    { immediate: true },
);

const FRAMING_LABEL: Record<NovatelMessageStats['framing'], string> = {
    binary: 'binary',
    shortBinary: 'binary · short',
    // NovAtel's name for the framing, not a text encoding
    // eslint-disable-next-line unicorn/text-encoding-identifier-case
    ascii: 'ASCII',
    abbreviated: 'abbrev. ASCII',
};

const isBinary = (row: NovatelMessageStats): boolean =>
    row.framing === 'binary' || row.framing === 'shortBinary';

const formatCount = (value: number): string => value.toLocaleString('de-CH');

const formatRate = (rate: number | undefined): string => {
    if (rate === undefined) return '–';
    if (rate >= 10) return `${rate.toFixed(0)} Hz`;
    if (rate >= 0.1) return `${rate.toFixed(1)} Hz`;
    return `every ${(1 / rate).toFixed(0)} s`;
};

const columns: QTableColumn<NovatelMessageStats>[] = [
    {
        name: 'name',
        label: 'Log',
        field: 'name',
        align: 'left',
        sortable: true,
    },
    {
        name: 'id',
        label: 'ID',
        field: (row) => row.id ?? '',
        align: 'right',
    },
    {
        name: 'framing',
        label: 'Format',
        field: (row) => FRAMING_LABEL[row.framing],
        align: 'left',
    },
    {
        name: 'count',
        label: 'Count',
        field: 'count',
        format: (value: number) => formatCount(value),
        align: 'right',
        sortable: true,
    },
    {
        name: 'rate',
        label: 'Avg. rate',
        field: (row) => row.rate,
        format: (value: number | undefined) => formatRate(value),
        align: 'right',
        sortable: true,
    },
];

/** `OEM7720-1.01` reads as OEM7720 on the card; the revision is detail. */
const hardwareName = computed(() => {
    const hardware = summary.value?.receiver?.hardware;
    return hardware ? hardware.split('-')[0] : 'OEM7';
});

const span = computed(() => {
    const start = summary.value?.startTime;
    const end = summary.value?.endTime;
    if (start === undefined || end === undefined) return;
    return {
        start: new Date(start),
        end: new Date(end),
        seconds: (end - start) / 1000,
    };
});

const trackLength = computed(() =>
    trackLengthMetres(summary.value?.track ?? []),
);

const formatSize = (bytes: number): string =>
    formatSizeWithUnit(bytes, 1000, 1);

const formatSpan = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${String(hours)} h ${String(minutes)} min`;
    if (minutes > 0) return `${String(minutes)} min ${String(secs)} s`;
    return `${String(secs)} s`;
};

const clock = (date: Date): string =>
    [date.getHours(), date.getMinutes(), date.getSeconds()]
        .map((part) => String(part).padStart(2, '0'))
        .join(':');

const sigmaLabel = (sigma: number | undefined): string | undefined =>
    sigma === undefined || !Number.isFinite(sigma)
        ? undefined
        : `σ ${sigma < 1 ? sigma.toFixed(2) : sigma.toFixed(1)} m`;

const formatCoordinate = (value: number | undefined): string =>
    value === undefined ? '' : value.toFixed(5);

const formatDistance = (metres: number): string =>
    metres >= 1000
        ? `${(metres / 1000).toFixed(2)} km`
        : `${metres.toFixed(0)} m`;
</script>

<style scoped>
.facts {
    border: 1px solid #e0e0e0;
}

.facts__item {
    padding: 12px 16px;
    min-width: 0;
    border-right: 1px solid #e0e0e0;
}

.facts__item:last-child {
    border-right: 0;
}

.facts__label {
    font-size: 12px;
    color: #666;
}

.facts__value {
    font-size: 14.5px;
    font-weight: 500;
}

.text-mono {
    font-family: 'Roboto Mono', monospace;
    font-size: 12.5px;
}

.message-table {
    max-height: 420px;
}

@media (max-width: 1023px) {
    .facts__item {
        border-right: 0;
        border-bottom: 1px solid #e0e0e0;
    }

    .facts__item:last-child {
        border-bottom: 0;
    }
}
</style>
