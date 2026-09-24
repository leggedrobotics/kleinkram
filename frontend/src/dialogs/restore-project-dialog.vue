<template>
    <base-dialog ref="dialogRef">
        <template #title> Restore Project</template>
        <template #content>
            <div
                v-if="current && project"
                style="display: flex; flex-direction: column; gap: 20px"
            >
                <p class="q-ma-none">
                    Recalls the {{ current.parts.length }} part(s) of
                    <b>{{ project.name }}</b> ({{ current.fileCount }} files,
                    {{ formatSize(current.totalBytes) }}) from tape and puts the
                    files back into the Kleinkram storage.
                </p>

                <q-list dense class="text-body2">
                    <q-item class="q-px-none">
                        <q-item-section avatar>
                            <q-icon name="sym_o_schedule" color="grey-8" />
                        </q-item-section>
                        <q-item-section>
                            Tapes have to be mounted and read sequentially.
                            Large projects take hours; progress is shown on the
                            project page.
                        </q-item-section>
                    </q-item>
                    <q-item class="q-px-none">
                        <q-item-section avatar>
                            <q-icon name="sym_o_payments" color="grey-8" />
                        </q-item-section>
                        <q-item-section>
                            ETH IT Services may charge for frequent recalls, and
                            the restored files count against the Kleinkram
                            storage again.
                        </q-item-section>
                    </q-item>
                    <q-item class="q-px-none">
                        <q-item-section avatar>
                            <q-icon name="sym_o_recycling" color="green-8" />
                        </q-item-section>
                        <q-item-section>
                            The copy on tape is kept. Archiving the project
                            again without changing its files only frees the
                            storage.
                        </q-item-section>
                    </q-item>
                </q-list>

                <q-input
                    v-model="reason"
                    outlined
                    autogrow
                    autofocus
                    label="Why is the data needed?"
                    hint="Required, e.g. 'Re-running the evaluation for the journal revision'"
                />
            </div>
            <q-skeleton v-else height="250px" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Request Restore"
                icon="sym_o_settings_backup_restore"
                class="bg-button-primary"
                :loading="submitting"
                :disable="reason.trim().length < 3"
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
import { restoreProject } from 'src/services/mutations/project';
import { computed, ref } from 'vue';

const { projectUuid } = defineProps<{ projectUuid: string }>();
const { dialogRef, onDialogOK } = useDialogPluginComponent();
const queryClient = useQueryClient();

const uuid = computed(() => projectUuid);
const { data: project } = useProjectQuery(uuid);
const { data: status } = useProjectArchiveStatus(uuid);
const current = computed(() => status.value?.current ?? null);

const reason = ref('');
const submitting = ref(false);

const submit = async (): Promise<void> => {
    submitting.value = true;
    try {
        await restoreProject(projectUuid, reason.value.trim());
        await queryClient.invalidateQueries({
            predicate: (q) =>
                q.queryKey[0] === 'projects' ||
                q.queryKey[0] === 'project-archive' ||
                (q.queryKey[0] === 'project' && q.queryKey[1] === projectUuid),
        });
        Notify.create({
            message: 'Restore requested, recalling the data from tape',
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
            message: `Could not restore the project: ${message}`,
            color: 'negative',
            position: 'bottom',
        });
    } finally {
        submitting.value = false;
    }
};
</script>
