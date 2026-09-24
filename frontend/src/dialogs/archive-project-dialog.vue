<template>
    <base-dialog ref="dialogRef">
        <template #title> Archive Project</template>
        <template #content>
            <div v-if="status && project" class="archive-dialog">
                <p class="q-ma-none">
                    Moves all files of <b>{{ project.name }}</b> to the ETH Long
                    Term Storage, a tape archive kept at two sites. Use it for
                    finished projects whose data has to be kept but is rarely
                    needed.
                </p>

                <div v-if="preflight" class="archive-summary">
                    <div>
                        <div class="text-caption text-grey-7">Missions</div>
                        <div class="text-h6">{{ preflight.missionCount }}</div>
                    </div>
                    <div>
                        <div class="text-caption text-grey-7">Files</div>
                        <div class="text-h6">{{ preflight.fileCount }}</div>
                    </div>
                    <div>
                        <div class="text-caption text-grey-7">Size</div>
                        <div class="text-h6">
                            {{ formatSize(preflight.totalBytes) }}
                        </div>
                    </div>
                    <div>
                        <div class="text-caption text-grey-7">Tar parts</div>
                        <div class="text-h6">
                            {{ preflight.estimatedParts }}
                        </div>
                    </div>
                    <div>
                        <div class="text-caption text-grey-7">
                            LTS cost / year
                        </div>
                        <div class="text-h6">
                            {{ formatCost(preflight.estimatedYearlyCostChf) }}
                        </div>
                    </div>
                </div>

                <div
                    v-if="preflight?.reusesPreviousArchive"
                    class="row no-wrap items-start text-body2 archive-note"
                >
                    <q-icon
                        name="sym_o_recycling"
                        size="20px"
                        class="q-mr-sm"
                        color="green-8"
                    />
                    Nothing changed since the last restore. The copy that is
                    still on tape is reused, only the Kleinkram storage is
                    freed.
                </div>

                <q-list dense class="text-body2">
                    <q-item class="q-px-none">
                        <q-item-section avatar>
                            <q-icon name="sym_o_check" color="green-8" />
                        </q-item-section>
                        <q-item-section>
                            Missions, metadata, topics and the file list stay
                            browsable and searchable.
                        </q-item-section>
                    </q-item>
                    <q-item class="q-px-none">
                        <q-item-section avatar>
                            <q-icon name="sym_o_block" color="negative" />
                        </q-item-section>
                        <q-item-section>
                            Files can no longer be downloaded, previewed,
                            uploaded, moved or processed by actions. The project
                            is read-only from now on.
                        </q-item-section>
                    </q-item>
                    <q-item class="q-px-none">
                        <q-item-section avatar>
                            <q-icon name="sym_o_schedule" color="grey-8" />
                        </q-item-section>
                        <q-item-section>
                            Getting the data back needs a restore, which recalls
                            the tapes and takes hours for large projects.
                        </q-item-section>
                    </q-item>
                </q-list>

                <div v-if="blockers.length > 0" class="archive-blockers">
                    <div class="text-weight-bold q-mb-xs">
                        The project cannot be archived yet:
                    </div>
                    <ul class="q-ma-none q-pl-md">
                        <li v-for="blocker in blockers" :key="blocker">
                            {{ blocker }}
                        </li>
                    </ul>
                </div>

                <q-input
                    v-model="reason"
                    outlined
                    autogrow
                    label="Reason (optional)"
                    hint="Shown in the archive history, e.g. 'Paper published, data kept for 10 years'"
                />

                <div>
                    <p class="q-mb-sm">
                        Please confirm by entering the project name:
                        <b>{{ project.name }}</b>
                    </p>
                    <q-input
                        v-model="nameCheck"
                        outlined
                        placeholder="Confirm Project Name"
                    />
                </div>
            </div>
            <q-skeleton v-else height="300px" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Archive Project"
                icon="sym_o_inventory_2"
                class="bg-button-primary"
                :loading="submitting"
                :disable="!canSubmit"
                @click="submit"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { AxiosError } from 'axios';
import { Notify, useDialogPluginComponent } from 'quasar';
import { useProjectArchiveStatus } from 'src/composables/use-project-archive';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useProjectQuery } from 'src/hooks/query-hooks';
import { formatSize } from 'src/services/general-formatting';
import { archiveProject } from 'src/services/mutations/project';
import { computed, ref } from 'vue';

const { projectUuid } = defineProps<{ projectUuid: string }>();
const { dialogRef, onDialogOK } = useDialogPluginComponent();
const queryClient = useQueryClient();

const uuid = computed(() => projectUuid);
const { data: project } = useProjectQuery(uuid);
const { data: status } = useProjectArchiveStatus(uuid);

const preflight = computed(() => status.value?.preflight ?? null);
const blockers = computed(() => preflight.value?.blockers ?? []);

const formatCost = (chf: number): string =>
    chf < 0.01 ? '< CHF 0.01' : `CHF ${chf.toFixed(2)}`;

const reason = ref('');
const nameCheck = ref('');
const submitting = ref(false);

const canSubmit = computed(
    () =>
        preflight.value !== null &&
        blockers.value.length === 0 &&
        nameCheck.value === project.value?.name,
);

const submit = async (): Promise<void> => {
    submitting.value = true;
    try {
        await archiveProject(projectUuid, reason.value.trim() || undefined);
        await queryClient.invalidateQueries({
            predicate: (q) =>
                q.queryKey[0] === 'projects' ||
                q.queryKey[0] === 'project-archive' ||
                (q.queryKey[0] === 'project' && q.queryKey[1] === projectUuid),
        });
        Notify.create({
            message: 'Archiving started, the project is now read-only',
            color: 'positive',
            position: 'bottom',
        });
        onDialogOK();
    } catch (error: unknown) {
        const message =
            error instanceof AxiosError
                ? ((error.response?.data as { message?: string } | undefined)
                      ?.message ?? error.message)
                : String(error);
        Notify.create({
            message: `Could not archive the project: ${message}`,
            color: 'negative',
            position: 'bottom',
        });
    } finally {
        submitting.value = false;
    }
};
</script>

<style scoped>
.archive-dialog {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.archive-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 12px;
    padding: 12px 16px;
    background: #f5f7fa;
    border-radius: 3px;
}

.archive-note {
    padding: 10px 12px;
    background: #eef7f0;
    border-radius: 3px;
}

.archive-blockers {
    padding: 10px 12px;
    background: #fdecec;
    color: #8a1c1c;
    border-radius: 3px;
}
</style>
