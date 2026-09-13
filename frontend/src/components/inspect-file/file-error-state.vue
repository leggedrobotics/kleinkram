<template>
    <!--
        One panel per state rather than a stack of banners: the diagnosis, the
        detail and what can be done about it all describe the same thing, and a
        page-wide block of saturated colour is a lot of weight for the state of
        a single file. The severity is carried by the icon and the accent rule
        down the side, on a surface that stays readable.
    -->
    <section
        class="file-error-state rounded-borders"
        :class="`file-error-state--${state.tone}`"
    >
        <div class="row no-wrap items-start q-gutter-sm">
            <q-icon
                :name="state.icon"
                size="28px"
                class="file-error-state__icon col-auto"
            />
            <div class="col">
                <h3 class="text-subtitle1 text-weight-medium q-ma-none">
                    {{ state.title }}
                </h3>
                <p class="text-body2 text-grey-8 q-mt-xs q-mb-none">
                    {{ state.description }}
                </p>

                <!-- What the ingestion actually complained about -->
                <div v-if="cause" class="q-mt-md">
                    <div
                        class="text-caption text-weight-medium text-grey-7 q-mb-xs"
                    >
                        Reported cause
                    </div>
                    <pre class="file-error-state__cause">{{ cause }}</pre>
                </div>

                <div
                    v-if="showRecovery"
                    class="file-error-state__recovery q-mt-md"
                >
                    <p class="text-body2 text-grey-8 q-mb-sm">
                        Kleinkram can try to rebuild this recording with
                        <code>mcap doctor</code> and <code>mcap recover</code>,
                        which walk the chunk structure and write out the
                        messages that are still readable as a new file.
                    </p>
                    <div class="row items-center q-gutter-sm">
                        <!--
                            Stays available after a run has been started: a
                            recovery that failed is exactly when you want to
                            try again.
                        -->
                        <q-btn
                            unelevated
                            no-caps
                            color="primary"
                            icon="sym_o_healing"
                            :label="
                                hasRecoveryAction
                                    ? 'Recover again'
                                    : 'Try to recover'
                            "
                            :loading="recovering"
                            @click="recoverFile"
                        >
                            <template #loading>
                                <q-spinner-hourglass class="on-left" />
                                Starting...
                            </template>
                        </q-btn>
                        <q-btn
                            v-if="hasRecoveryAction"
                            flat
                            dense
                            no-caps
                            color="primary"
                            icon-right="sym_o_open_in_new"
                            label="View recovery run"
                            :to="actionLink"
                        />
                    </div>
                </div>

                <div v-if="recoveredFileUuid" class="q-mt-md">
                    <q-btn
                        outline
                        no-caps
                        color="primary"
                        icon="sym_o_task_alt"
                        label="Open recovered file"
                        :to="recoveredFileRoute"
                    />
                </div>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import type { FileDto } from '@kleinkram/api-dto/types/file/file.dto';
import { FileEventType, FileState } from '@kleinkram/shared';
import { useQuasar } from 'quasar';
import { recoverMcapFile } from 'src/services/mutations/file';
import { getFileEvents } from 'src/services/queries/file';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

interface ErrorPresentation {
    tone: 'negative' | 'warning' | 'neutral';
    icon: string;
    title: string;
    description: string;
}

const properties = defineProps<{
    file: FileDto;
}>();

const $q = useQuasar();
const route = useRoute();
const recovering = ref(false);
const recoveryActionUuid = ref<string | undefined>(undefined);

const fileExtension = computed(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    () => properties.file.filename?.split('.').pop()?.toLowerCase() ?? '',
);

const state = computed<ErrorPresentation>(() => {
    switch (properties.file.state) {
        case FileState.CORRUPTED: {
            return {
                tone: 'negative',
                icon: 'sym_o_broken_image',
                title: 'This file is corrupted',
                description: `Its contents do not match what a .${fileExtension.value} file should look like, so it cannot be previewed or processed.`,
            };
        }
        case FileState.CONVERSION_ERROR: {
            return {
                tone: 'negative',
                icon: 'sym_o_conversion_path_off',
                title: 'Conversion failed',
                description:
                    'The file was stored, but converting it for playback did not finish.',
            };
        }
        case FileState.ERROR: {
            return {
                tone: 'negative',
                icon: 'sym_o_error',
                title: 'Processing failed',
                description:
                    'Something went wrong while processing this file after upload.',
            };
        }
        case FileState.LOST: {
            return {
                tone: 'warning',
                icon: 'sym_o_pulse_alert',
                title: 'File is missing from storage',
                description:
                    'Kleinkram still knows about this file, but its contents are no longer in storage.',
            };
        }
        default: {
            return {
                tone: 'neutral',
                icon: 'sym_o_draft',
                title: 'No preview available',
                description: `Kleinkram cannot render a preview for .${fileExtension.value} files. The file itself is fine and can be downloaded.`,
            };
        }
    }
});

/** Only a failure has a cause; a missing preview is not one. */
const cause = computed(() =>
    state.value.tone === 'neutral' ? undefined : properties.file.state_cause,
);

const recoveredFileUuid = computed(() => properties.file.relatedFileUuid);

const showRecovery = computed(
    () =>
        properties.file.state === FileState.CORRUPTED &&
        fileExtension.value === 'mcap' &&
        !recoveredFileUuid.value,
);

const hasRecoveryAction = computed(
    () => recoveryActionUuid.value !== undefined,
);

const actionLink = computed(() => ({
    name: 'AnalysisDetailsPage',
    params: { id: recoveryActionUuid.value },
}));

const recoveredFileRoute = computed(() => ({
    name: 'FilePage',
    params: {
        ...route.params,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        file_uuid: recoveredFileUuid.value,
    },
}));

onMounted(async () => {
    if (properties.file.state !== FileState.CORRUPTED) return;

    try {
        const events = await getFileEvents(properties.file.uuid);
        const recoveryEvent = events.data.find(
            (fileEvent) =>
                fileEvent.type === FileEventType.RECOVERY_TRIGGERED &&
                fileEvent.action !== undefined,
        );
        recoveryActionUuid.value = recoveryEvent?.action?.uuid;
    } catch {
        // A missing history only costs us the link to the running recovery.
    }
});

const recoverFile = async (): Promise<void> => {
    recovering.value = true;
    try {
        const result = await recoverMcapFile(properties.file.uuid);
        recoveryActionUuid.value = result.actionUUID;
        $q.notify({
            message: 'Recovery started for this file',
            color: 'positive',
            icon: 'sym_o_healing',
            position: 'bottom',
            timeout: 3000,
        });
    } catch (error_: unknown) {
        const error = error_ as { response?: { data?: { message?: string } } };
        $q.notify({
            message:
                error.response?.data?.message ?? 'Could not start recovery',
            color: 'negative',
            icon: 'sym_o_warning',
            position: 'bottom',
            timeout: 3000,
        });
    } finally {
        recovering.value = false;
    }
};
</script>

<style scoped>
.file-error-state {
    padding: 20px;
    border: 1px solid #e0e0e0;
    border-left-width: 4px;
    background-color: #fafafa;
}

/* The accent rule and the icon carry the severity, the surface stays legible */
.file-error-state--negative {
    border-left-color: var(--q-negative);
    background-color: #fdf5f6;
}

.file-error-state--negative .file-error-state__icon {
    color: var(--q-negative);
}

.file-error-state--warning {
    border-left-color: var(--q-warning);
    background-color: #fffaf2;
}

.file-error-state--warning .file-error-state__icon {
    color: var(--q-warning);
}

.file-error-state--neutral {
    border-left-color: #bdbdbd;
}

.file-error-state--neutral .file-error-state__icon {
    color: #9e9e9e;
}

.file-error-state__cause {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background-color: #fff;
    color: #424242;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.5;
    /* Long parser messages scroll in place instead of widening the page */
    max-width: 100%;
    overflow-x: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.file-error-state__recovery code {
    padding: 1px 5px;
    border-radius: 3px;
    background-color: rgba(0, 0, 0, 0.06);
    font-size: 0.9em;
}

@media (max-width: 599px) {
    .file-error-state {
        padding: 16px;
    }
}
</style>
