<template>
    <title-section :title="`File: ${file?.filename ?? 'Loading...'}`">
        <template #title>
            <h1 class="text-h5 text-md-h3 q-ma-none file-header__title">
                <span v-if="!$q.screen.xs">File: </span>
                {{ file?.filename ?? 'Loading...' }}
                <q-tooltip v-if="file?.filename">
                    {{ file.filename }}
                </q-tooltip>
            </h1>
        </template>

        <template #buttons>
            <div
                class="column row-md items-end q-gutter-sm file-header__actions"
            >
                <button-group class="col-auto">
                    <edit-file-button v-if="file" :file="file" />

                    <q-btn
                        class="button-border"
                        flat
                        icon="sym_o_download"
                        label="Download"
                        :disable="isDownloadDisabled"
                        @click="handleDownload"
                    />

                    <q-btn
                        flat
                        icon="sym_o_more_vert"
                        color="primary"
                        aria-label="More file actions"
                        class="cursor-pointer button-border"
                        @click.stop
                    >
                        <q-menu v-if="file" auto-close>
                            <q-list>
                                <q-item
                                    v-ripple
                                    clickable
                                    :disable="isInvalid"
                                    @click="handleCopyFoxglove"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_monitor_heart" />
                                    </q-item-section>
                                    <q-item-section>
                                        Copy Foxglove link
                                    </q-item-section>
                                </q-item>

                                <q-item
                                    v-ripple
                                    clickable
                                    :disable="isInvalid"
                                    @click="handleCopyLink"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_content_copy" />
                                    </q-item-section>
                                    <q-item-section>
                                        Copy public link
                                    </q-item-section>
                                </q-item>
                                <q-item
                                    v-ripple
                                    clickable
                                    :disable="!file?.hash"
                                    @click="handleCopyHash"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_encrypted" />
                                    </q-item-section>
                                    <q-item-section>Copy MD5</q-item-section>
                                </q-item>
                                <q-item
                                    v-ripple
                                    clickable
                                    @click="handleCopyUuid"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_fingerprint" />
                                    </q-item-section>
                                    <q-item-section>Copy UUID</q-item-section>
                                </q-item>
                                <q-item
                                    v-ripple
                                    clickable
                                    class="text-negative"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_delete" />
                                    </q-item-section>
                                    <q-item-section>
                                        <DeleteFileDialogOpener
                                            v-if="file"
                                            :file="file"
                                        >
                                            Delete File
                                        </DeleteFileDialogOpener>
                                    </q-item-section>
                                </q-item>
                            </q-list>
                        </q-menu>
                    </q-btn>
                </button-group>
                <div class="col-auto">
                    <KleinDownloadFile v-if="file" :file="file" />
                </div>
            </div>
        </template>

        <template #subtitle>
            <div class="q-gutter-md q-mt-xs file-header__body">
                <div class="row items-start q-gutter-y-sm file-header__meta">
                    <div class="col-12 col-md-2">
                        <div class="file-header__meta-item">
                            <div class="text-placeholder">Project</div>
                            <div class="text-subtitle1 text-primary ellipsis">
                                {{ file?.mission.project.name }}
                                <q-tooltip>
                                    {{ file?.mission.project.name }}
                                </q-tooltip>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-md-2">
                        <div class="file-header__meta-item">
                            <div class="text-placeholder">Mission</div>
                            <div class="text-subtitle1 text-primary ellipsis">
                                {{ file?.mission.name }}
                                <q-tooltip>{{ file?.mission.name }}</q-tooltip>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-md-2">
                        <div class="file-header__meta-item">
                            <div class="text-placeholder">Start Date</div>
                            <div class="text-subtitle1 text-primary">
                                {{
                                    recordingStart
                                        ? formatDate(recordingStart, true)
                                        : '-'
                                }}
                                <q-tooltip v-if="!recordingStart">
                                    The recording start is only known once the
                                    messages of this file have been indexed.
                                </q-tooltip>
                            </div>
                            <div
                                v-if="duration"
                                class="text-caption text-placeholder"
                            >
                                Duration {{ duration }}
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-md-2">
                        <div class="file-header__meta-item">
                            <div class="text-placeholder">Uploaded</div>
                            <div class="text-subtitle1 text-primary">
                                {{
                                    file?.createdAt
                                        ? formatDate(file.createdAt, true)
                                        : '-'
                                }}
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-md-2">
                        <div
                            v-if="file?.creator"
                            class="file-header__meta-item"
                        >
                            <div class="text-placeholder">Creator</div>
                            <div class="text-subtitle1 text-primary ellipsis">
                                {{ file?.creator.name }}
                                <q-tooltip>{{ file?.creator.name }}</q-tooltip>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-md-1">
                        <div class="file-header__meta-item">
                            <div class="text-placeholder">File State</div>
                            <q-icon
                                :name="getIcon(file?.state ?? FileState.OK)"
                                :color="
                                    getColorFileState(
                                        file?.state ?? FileState.OK,
                                    )
                                "
                                size="sm"
                            >
                                <q-tooltip>
                                    {{ getTooltip(file?.state) }}
                                </q-tooltip>
                            </q-icon>
                        </div>
                    </div>
                    <div class="col-12 col-md-1">
                        <div class="file-header__meta-item">
                            <div class="text-placeholder">Size</div>
                            <div class="text-subtitle1 text-primary">
                                {{
                                    file?.size ? formatSize(file?.size) : '...'
                                }}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="row items-start q-gutter-xs">
                    <q-chip
                        v-for="cat in file?.categories"
                        :key="cat.uuid"
                        :label="cat.name"
                        :style="{ backgroundColor: hashUUIDtoColor(cat.uuid) }"
                        text-color="white"
                        size="sm"
                    />
                </div>
            </div>
        </template>
    </title-section>
</template>

<script setup lang="ts">
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import { FileState } from '@kleinkram/shared';
import DeleteFileDialogOpener from 'components/button-wrapper/delete-file-dialog-opener.vue';
import ButtonGroup from 'components/buttons/button-group.vue';
import EditFileButton from 'components/buttons/edit-file-button.vue';
import KleinDownloadFile from 'components/cli-links/klein-download-file.vue';
import TitleSection from 'components/title-section.vue';
import { useQuasar } from 'quasar';
import { formatDate, formatDuration } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import {
    getColorFileState,
    getIcon,
    getTooltip,
    hashUUIDtoColor,
} from 'src/services/generic';
import { computed } from 'vue';

const $q = useQuasar();

const properties = defineProps<{ file: FileWithTopicDto }>();
const emit = defineEmits([
    'download',
    'copy-link',
    'copy-foxglove',
    'copy-hash',
    'copy-uuid',
]);

/**
 * `date` falls back to the upload time for files we could not read a recording
 * start from, so the header only ever shows `recordingStartDate`.
 */
const recordingStart = computed(
    () =>
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        properties.file?.recordingStartDate ?? undefined,
);

const duration = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const seconds = properties.file?.durationSeconds ?? undefined;
    return seconds === undefined ? undefined : formatDuration(seconds);
});

const isDownloadDisabled = computed(() =>
    [FileState.LOST, FileState.UPLOADING].includes(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        properties.file?.state ?? FileState.LOST,
    ),
);
const isInvalid = computed(
    () =>
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        properties.file?.state === FileState.LOST ||
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        properties.file?.state === FileState.ERROR,
);

const handleDownload = (): void => {
    emit('download');
};

const handleCopyLink = (): void => {
    emit('copy-link');
};

const handleCopyHash = (): void => {
    emit('copy-hash');
};

const handleCopyUuid = (): void => {
    emit('copy-uuid');
};

const handleCopyFoxglove = (): void => {
    emit('copy-foxglove');
};
</script>

<style scoped>
.text-placeholder {
    font-size: 12px;
    color: #666;
}
.button-border {
    border: 1px solid #ddd;
}

/* Matches the default title of title-section (ellipsis on one line) */
.file-header__title {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

/* Below the desktop breakpoint the file name wraps instead of being cut */
@media (max-width: 1023px) {
    .file-header__title {
        overflow: visible;
        white-space: normal;
        overflow-wrap: anywhere;
    }
}

@media (max-width: 599px) {
    /* q-gutter-md widens the block by its negative margin, which pushed
       the right edge past the card on phones; use plain vertical spacing */
    .file-header__body {
        margin-left: 0 !important;
    }

    .file-header__body > * {
        margin-left: 0 !important;
        margin-top: 12px !important;
    }

    .file-header__meta {
        margin-top: 0 !important;
    }

    .file-header__meta > * {
        padding-top: 0;
        margin-top: 10px;
    }

    /* Actions stretch to the full width so nothing sticks out to the right */
    .file-header__actions {
        align-items: stretch;
        width: 100%;
        min-width: 0;
    }

    /* Stacked label/value pairs: small label above a wrapping value */
    .file-header__meta .file-header__meta-item {
        min-width: 0;
    }

    .file-header__meta .file-header__meta-item > :last-child {
        min-width: 0;
        overflow: visible;
        white-space: normal;
        overflow-wrap: anywhere;
    }
}
</style>
