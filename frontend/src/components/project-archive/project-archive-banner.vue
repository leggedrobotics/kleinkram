<template>
    <div
        v-if="status && status.archiveState !== ProjectArchiveState.ACTIVE"
        class="archive-banner q-pa-md"
        :class="[
            $q.screen.xs ? 'q-mt-md' : 'q-mt-lg',
            `archive-banner--${status.archiveState.toLowerCase()}`,
        ]"
    >
        <div class="row items-start no-wrap">
            <q-icon
                :name="icon"
                size="22px"
                class="q-mr-md archive-banner__icon"
            />
            <div class="col">
                <div class="text-weight-bold">{{ title }}</div>
                <div class="text-body2 text-grey-8">{{ description }}</div>

                <div
                    v-if="steps.length > 0 && current"
                    class="archive-steps q-mt-md"
                >
                    <div
                        v-for="(step, index) in steps"
                        :key="step.state"
                        class="archive-step"
                        :class="{
                            'archive-step--done': index < activeIndex,
                            'archive-step--active': index === activeIndex,
                        }"
                    >
                        <q-icon
                            :name="
                                index < activeIndex
                                    ? 'sym_o_check_circle'
                                    : index === activeIndex
                                      ? 'sym_o_pending'
                                      : 'sym_o_radio_button_unchecked'
                            "
                            size="18px"
                        />
                        <span>{{ step.label }}</span>
                        <q-tooltip>{{ step.hint }}</q-tooltip>
                    </div>
                </div>

                <div v-if="showProgress && current" class="q-mt-sm">
                    <q-linear-progress
                        :value="progress"
                        rounded
                        size="6px"
                        color="primary"
                        track-color="grey-3"
                    />
                    <div class="text-caption text-grey-7 q-mt-xs">
                        {{ formatSize(current.bytesProcessed) }} of
                        {{ formatSize(current.totalBytes) }}
                        <span v-if="activeStep"> · {{ activeStep.hint }}</span>
                    </div>
                </div>
                <div
                    v-else-if="activeStep"
                    class="text-caption text-grey-7 q-mt-sm"
                >
                    {{ activeStep.hint }}
                </div>

                <div
                    v-if="
                        status.archiveState === ProjectArchiveState.ARCHIVED &&
                        !status.storage.enabled
                    "
                    class="text-caption text-grey-7 q-mt-sm"
                >
                    Restoring is not enabled on this Kleinkram instance; ask its
                    administrators to get the data back.
                </div>

                <div
                    v-if="current?.error"
                    class="text-caption text-negative q-mt-sm"
                >
                    Last attempt failed: {{ current.error }}
                </div>
            </div>

            <restore-project-dialog-opener
                v-if="
                    status.archiveState === ProjectArchiveState.ARCHIVED &&
                    status.storage.enabled &&
                    canManage
                "
                :project-uuid="projectUuid"
            >
                <q-btn
                    flat
                    class="button-border q-ml-md"
                    color="primary"
                    icon="sym_o_settings_backup_restore"
                    :label="$q.screen.xs ? undefined : 'Restore'"
                    aria-label="Restore project"
                />
            </restore-project-dialog-opener>
        </div>

        <q-expansion-item
            v-if="status.restoreInstructions"
            dense
            dense-toggle
            class="q-mt-sm archive-banner__details"
            label="Access the files without Kleinkram"
            header-class="text-caption text-grey-8 q-px-none"
        >
            <div
                v-if="status.storage.description"
                class="text-body2 text-grey-8 q-mt-xs"
            >
                {{ status.storage.description }}
            </div>
            <pre class="archive-banner__instructions q-mt-sm q-mb-none">{{
                status.restoreInstructions
            }}</pre>
            <div
                v-if="status.storage.links.length > 0"
                class="row q-mt-sm"
                style="gap: 16px"
            >
                <a
                    v-for="link in status.storage.links"
                    :key="link.url"
                    :href="link.url"
                    target="_blank"
                    rel="noopener"
                    class="text-caption text-button-primary"
                >
                    {{ link.label }}
                </a>
            </div>
        </q-expansion-item>

        <q-expansion-item
            v-if="current && current.parts.length > 0"
            dense
            dense-toggle
            class="q-mt-sm archive-banner__details"
            :label="`${current.parts.length} part(s) on ${current.location}`"
            header-class="text-caption text-grey-8 q-px-none"
        >
            <q-markup-table flat dense class="q-mt-xs">
                <thead>
                    <tr>
                        <th class="text-left">Part</th>
                        <th class="text-right">Files</th>
                        <th class="text-right">Size</th>
                        <th class="text-left">SHA-256</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="part in current.parts" :key="part.name">
                        <td>{{ part.name }}</td>
                        <td class="text-right">{{ part.fileCount }}</td>
                        <td class="text-right">{{ formatSize(part.size) }}</td>
                        <td class="text-mono ellipsis" style="max-width: 200px">
                            {{ part.sha256 }}
                        </td>
                    </tr>
                </tbody>
            </q-markup-table>
            <div
                v-if="current.reason || current.restoreReason"
                class="text-caption text-grey-8 q-mt-sm"
            >
                <div v-if="current.reason">
                    Archived by {{ current.requestedBy ?? 'unknown' }}: “{{
                        current.reason
                    }}”
                </div>
                <div v-if="current.restoreReason">
                    Last restore requested by
                    {{ current.restoreRequestedBy ?? 'unknown' }}: “{{
                        current.restoreReason
                    }}”
                </div>
            </div>
        </q-expansion-item>
    </div>
</template>

<script setup lang="ts">
import { ProjectArchiveJobState, ProjectArchiveState } from '@kleinkram/shared';
import RestoreProjectDialogOpener from 'components/project-archive/restore-project-dialog-opener.vue';
import { useQuasar } from 'quasar';
import {
    ARCHIVE_STEPS,
    RESTORE_STEPS,
    useProjectArchiveStatus,
} from 'src/composables/use-project-archive';
import { canDeleteProject, usePermissionsQuery } from 'src/hooks/query-hooks';
import { formatDate } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import { computed } from 'vue';

const { projectUuid } = defineProps<{ projectUuid: string }>();

const $q = useQuasar();
const { data: status } = useProjectArchiveStatus(computed(() => projectUuid));
const { data: permissions } = usePermissionsQuery();
const canManage = computed(() =>
    canDeleteProject(projectUuid, permissions.value),
);

const current = computed(() => status.value?.current ?? null);
const storageName = computed(
    () => status.value?.storage.name ?? 'archive storage',
);

const steps = computed(() => {
    switch (status.value?.archiveState) {
        case ProjectArchiveState.ARCHIVING: {
            return ARCHIVE_STEPS;
        }
        case ProjectArchiveState.RESTORING: {
            return RESTORE_STEPS;
        }
        default: {
            return [];
        }
    }
});

const activeIndex = computed(() => {
    const state = current.value?.state;
    if (state === ProjectArchiveJobState.QUEUED) return 0;
    return steps.value.findIndex((step) => step.state === state);
});
const activeStep = computed(() => steps.value[activeIndex.value]);

/** Only the phases that move bytes have a meaningful progress bar. */
const TRANSFER_STATES = new Set([
    ProjectArchiveJobState.PACKING,
    ProjectArchiveJobState.RECALLING,
    ProjectArchiveJobState.UNPACKING,
]);
const showProgress = computed(
    () => current.value !== null && TRANSFER_STATES.has(current.value.state),
);
const progress = computed(() => {
    const total = current.value?.totalBytes ?? 0;
    return total > 0 ? (current.value?.bytesProcessed ?? 0) / total : 0;
});

const icon = computed(() => {
    switch (status.value?.archiveState) {
        case ProjectArchiveState.RESTORING: {
            return 'sym_o_settings_backup_restore';
        }
        case ProjectArchiveState.ARCHIVING: {
            return 'sym_o_move_to_inbox';
        }
        default: {
            return 'sym_o_inventory_2';
        }
    }
});

const title = computed(() => {
    switch (status.value?.archiveState) {
        case ProjectArchiveState.ARCHIVING: {
            return `This project is being moved to the ${storageName.value}.`;
        }
        case ProjectArchiveState.RESTORING: {
            return `This project is being restored from the ${storageName.value}.`;
        }
        default: {
            const since = current.value?.archivedAt;
            return since
                ? `This project was archived on ${formatDate(new Date(since))}.`
                : 'This project is archived.';
        }
    }
});

const description = computed(() => {
    const size = formatSize(current.value?.totalBytes ?? 0);
    const files = current.value?.fileCount ?? 0;
    switch (status.value?.archiveState) {
        case ProjectArchiveState.ARCHIVING: {
            return `${files.toString()} files (${size}). The project is read-only until it is archived.`;
        }
        case ProjectArchiveState.RESTORING: {
            return `${files.toString()} files (${size}). Downloads and uploads open up again once all files are back.`;
        }
        default: {
            return `Its ${files.toString()} files (${size}) are on the ${storageName.value}. Missions, metadata and topics stay searchable, but files cannot be downloaded, uploaded or processed until the project is restored.`;
        }
    }
});
</script>

<style scoped>
.archive-banner {
    background: #ffffff;
    border: 1px solid #d5dbe6;
    border-left: 4px solid #3d5a80;
    border-radius: 3px;
}

.archive-banner__icon {
    color: #3d5a80;
}

.archive-banner--archiving,
.archive-banner--restoring {
    border-left-color: #c77d00;
}

.archive-banner--archiving .archive-banner__icon,
.archive-banner--restoring .archive-banner__icon {
    color: #c77d00;
}

.archive-steps {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 20px;
}

.archive-step {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #9aa3ad;
    font-size: 13px;
}

.archive-step--done {
    color: #1b7a3a;
}

.archive-step--active {
    color: #1d2733;
    font-weight: 600;
}

.archive-banner__instructions {
    white-space: pre-wrap;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    padding: 10px 12px;
    background: #f5f7fa;
    border-radius: 3px;
}

.text-mono {
    font-family: ui-monospace, monospace;
    font-size: 12px;
}
</style>
