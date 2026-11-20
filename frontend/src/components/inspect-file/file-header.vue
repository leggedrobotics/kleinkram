<template>
    <title-section :title="`File: ${file?.filename ?? 'Loading...'}`">
        <template #title>
            <div class="file-header__heading">
                <h1 class="text-h5 text-md-h3 q-ma-none file-header__title">
                    {{ file?.filename ?? 'Loading...' }}
                    <q-tooltip v-if="file?.filename">
                        {{ file.filename }}
                    </q-tooltip>
                </h1>
                <span v-if="file?.type" class="file-header__type">
                    {{ file.type }}
                </span>
                <span
                    v-if="file"
                    class="file-header__state"
                    :class="`file-header__state--${stateTone}`"
                >
                    <q-icon :name="getIcon(file.state)" size="16px" />
                    {{ stateLabel }}
                    <q-tooltip>
                        {{ getTooltip(file.state, file.stateComment) }}
                    </q-tooltip>
                </span>
            </div>
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
                                <DeleteFileDialogOpener
                                    v-if="file"
                                    :file="file"
                                >
                                    <q-item
                                        v-ripple
                                        clickable
                                        class="text-negative"
                                    >
                                        <q-item-section avatar>
                                            <q-icon name="sym_o_delete" />
                                        </q-item-section>
                                        <q-item-section>
                                            Delete File
                                        </q-item-section>
                                    </q-item>
                                </DeleteFileDialogOpener>
                            </q-list>
                        </q-menu>
                    </q-btn>
                </button-group>
            </div>
        </template>

        <template #subtitle>
            <div
                v-if="file?.categories.length"
                class="row items-start q-gutter-xs file-header__categories"
            >
                <q-chip
                    v-for="cat in file.categories"
                    :key="cat.uuid"
                    :label="cat.name"
                    :style="categoryTagStyle(cat.uuid)"
                    size="sm"
                >
                    <q-tooltip v-if="cat.description">
                        {{ cat.description }}
                    </q-tooltip>
                </q-chip>
            </div>
            <dl v-if="file" class="file-header__facts">
                <div class="file-header__fact">
                    <dt>Project</dt>
                    <dd>
                        <router-link :to="projectPath">
                            {{ file.mission.project.name }}
                        </router-link>
                    </dd>
                </div>
                <div class="file-header__fact">
                    <dt>Mission</dt>
                    <dd>
                        <router-link :to="missionPath">
                            {{ file.mission.name }}
                        </router-link>
                    </dd>
                </div>
                <div class="file-header__fact">
                    <dt>Recording</dt>
                    <dd v-if="recordingStart">
                        {{ formatDate(recordingStart) }}
                        <span v-if="duration" class="file-header__secondary">
                            · {{ duration }}
                        </span>
                    </dd>
                    <dd v-else class="file-header__muted">
                        Not recorded
                        <q-tooltip>
                            The recording start is only known once the messages
                            of this file have been indexed.
                        </q-tooltip>
                    </dd>
                </div>
                <div class="file-header__fact">
                    <dt>Size</dt>
                    <dd>{{ formatSize(file.size) }}</dd>
                </div>
                <div class="file-header__fact">
                    <dt>Uploaded</dt>
                    <dd>
                        {{ formatDate(file.createdAt) }}
                        <span
                            v-if="file.creator"
                            class="file-header__secondary"
                        >
                            by {{ file.creator.name }}
                        </span>
                    </dd>
                </div>
            </dl>
        </template>

        <template #footer>
            <div v-if="file" class="file-header__cli">
                <span class="file-header__cli-label">CLI</span>
                <code class="file-header__cli-command">{{ cliCommand }}</code>
                <q-btn
                    flat
                    dense
                    no-caps
                    class="file-header__cli-copy"
                    :icon="copied ? 'sym_o_check' : 'sym_o_content_copy'"
                    :label="copied ? 'Copied' : 'Copy'"
                    aria-label="Copy CLI command"
                    @click="copyCli"
                />
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
import TitleSection from 'components/title-section.vue';
import { formatDate, formatDuration } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import { categoryTagStyle, getIcon, getTooltip } from 'src/services/generic';
import { computed, ref } from 'vue';

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
const recordingStart = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const start = properties.file?.recordingStartDate ?? undefined;
    // a start at the Unix epoch is a placeholder, not a recording time
    if (start === undefined || new Date(start).getTime() <= 0) return;
    return start;
});

const duration = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const seconds = properties.file?.durationSeconds ?? undefined;
    return seconds === undefined || seconds <= 0
        ? undefined
        : formatDuration(seconds);
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

/** short state names; the tooltip keeps the full explanation */
const STATE_LABELS: Record<FileState, string> = {
    [FileState.OK]: 'Ready',
    [FileState.FOUND]: 'Ready',
    [FileState.UPLOADING]: 'Uploading',
    [FileState.CONVERTING]: 'Converting',
    [FileState.ERROR]: 'Error',
    [FileState.CONVERSION_ERROR]: 'Conversion failed',
    [FileState.CORRUPTED]: 'Corrupted',
    [FileState.LOST]: 'Missing in storage',
    [FileState.CANCELED]: 'Canceled',
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const stateLabel = computed(() => STATE_LABELS[properties.file?.state] ?? '');

/** colour family of the state pill: done, running, failed or neutral */
const stateTone = computed(() => {
    switch (properties.file.state) {
        case FileState.OK:
        case FileState.FOUND: {
            return 'ok';
        }
        case FileState.UPLOADING:
        case FileState.CONVERTING: {
            return 'running';
        }
        case FileState.CANCELED: {
            return 'neutral';
        }
        default: {
            return 'failed';
        }
    }
});

const projectPath = computed(
    () => `/project/${properties.file.mission.project.uuid}/missions`,
);
const missionPath = computed(
    () =>
        `/project/${properties.file.mission.project.uuid}/mission/${properties.file.mission.uuid}/files`,
);

const cliCommand = computed(
    () => `klein download --dest=. ${properties.file.uuid}`,
);
const copied = ref(false);
const copyCli = async (): Promise<void> => {
    await navigator.clipboard.writeText(cliCommand.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
};

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
.file-header__heading {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.file-header__type {
    flex: none;
    padding: 1px 6px;
    border-radius: 3px;
    background: #e0e0e0;
    color: #161616;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
}

.file-header__state {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    padding: 2px 10px 2px 6px;
    border-radius: 12px;
    font-size: 12.5px;
    font-weight: 500;
}

.file-header__state--ok {
    background: #defbe6;
    color: #0e6027;
}

.file-header__state--running {
    background: #edf5ff;
    color: #0043ce;
}

.file-header__state--failed {
    background: #fff1f1;
    color: #a2191f;
}

.file-header__state--neutral {
    background: #e0e0e0;
    color: #161616;
}

.file-header__categories {
    margin-top: -8px;
    margin-bottom: 8px;
}

/* one row of facts, each as wide as its value; wraps on narrow screens */
.file-header__facts {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 32px;
    margin: 0;
}

.file-header__fact dt {
    margin-bottom: 2px;
    color: #6f6f6f; /* $text-placeholder */
    font-size: 12px;
}

.file-header__fact dd {
    margin: 0;
    color: #161616;
    font-size: 14px;
    white-space: nowrap;
}

.file-header__fact a {
    color: #0f62fe; /* $link-primary */
    text-decoration: none;
}

.file-header__fact a:hover {
    text-decoration: underline;
}

.file-header__secondary {
    color: #525252; /* $text-secondary */
}

.file-header__muted {
    color: #6f6f6f;
}

.file-header__cli {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
}

.file-header__cli-label {
    flex: none;
    color: #525252;
    font-size: 12px;
}

.file-header__cli-command {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    font-size: 13px;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.file-header__cli-copy {
    flex: none;
    padding: 0 10px;
    border: 1px solid #c6c6c6;
    border-radius: 4px;
    background: #fff;
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

    /* Actions stretch to the full width so nothing sticks out to the right */
    .file-header__actions {
        align-items: stretch;
        width: 100%;
        min-width: 0;
    }

    .file-header__fact dd {
        white-space: normal;
        overflow-wrap: anywhere;
    }
}
</style>
