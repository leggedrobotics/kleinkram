<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="running"
        :submit-disabled="running"
        @submit="onOKClick"
    >
        <template #title>Invalid File Names</template>

        <template #content>
            <p class="text-secondary">
                The following files have invalid names. Please rename them to
                proceed.
            </p>
            <q-form ref="formReference" greedy @submit.prevent>
                <div v-for="(file, index) in localFiles" :key="index">
                    <label :for="`${idPrefix}-${String(index)}`">
                        Rename <b>{{ file.originalName }}</b>
                    </label>
                    <NameField
                        :id="`${idPrefix}-${String(index)}`"
                        v-model="file.baseName"
                        kind="file"
                        :suffix="file.extension"
                        label="File name"
                        :autofocus="index === 0"
                        :server-error="file.serverError"
                        @edit="() => (file.serverError = '')"
                    />
                </div>
            </q-form>
        </template>

        <template #actions>
            <q-btn
                flat
                no-caps
                label="Retry Upload"
                class="bg-button-primary"
                :loading="running"
                @click="onOKClick"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { FILE_EXTENSIONS, splitFileName } from '@kleinkram/validation/frontend';
import { isAxiosError } from 'axios';
import NameField from 'components/common/name-field.vue';
import { QForm, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { getDialogErrorMessage } from 'src/services/error-handling';
import { ref, useId } from 'vue';

export interface InvalidFile {
    filename: string;
    error: string;
}

const { invalidFiles, action } = defineProps<{
    invalidFiles: InvalidFile[];
    /**
     * Retries the upload with the new names (original name to new name).
     * The dialog closes when it succeeds; per-file errors it throws are shown
     * on the matching file, any other error in the error strip.
     */
    action: (renameMap: Record<string, string>) => Promise<unknown>;
}>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const idPrefix = `rename-file-${useId()}`;
const formReference = ref<QForm>();

const localFiles = ref(
    invalidFiles.map((f) => {
        const { name, extension } = splitFileName(f.filename);
        // the server only accepts lowercase extensions
        const lowerExtension = extension.toLowerCase();
        return {
            originalName: f.filename,
            baseName: name,
            // fixed: only the base name can be renamed
            extension: FILE_EXTENSIONS.includes(lowerExtension)
                ? lowerExtension
                : extension,
            serverError: f.error,
        };
    }),
);

const running = ref(false);
const errorMessage = ref('');

/** The per-file errors of a rejected retry, `[{ filename, error }]` */
const fileErrorsOf = (error: unknown): InvalidFile[] | undefined => {
    if (!isAxiosError(error)) return undefined;
    const errors = (error.response?.data as { errors?: unknown } | undefined)
        ?.errors;
    if (!Array.isArray(errors)) return undefined;
    return (errors as Partial<InvalidFile>[]).filter(
        (entry): entry is InvalidFile =>
            typeof entry.filename === 'string' &&
            typeof entry.error === 'string',
    );
};

async function onOKClick(): Promise<void> {
    if (running.value) return;
    if (!(await formReference.value?.validate(true))) return;
    const renameMap: Record<string, string> = {};
    for (const f of localFiles.value) {
        renameMap[f.originalName] = f.baseName + f.extension;
    }

    running.value = true;
    errorMessage.value = '';
    try {
        await action(renameMap);
    } catch (error: unknown) {
        const fileErrors = fileErrorsOf(error);
        // errors about one of the renamed files go on that file
        const unmatched = (fileErrors ?? []).filter((fileError) => {
            const row = localFiles.value.find(
                (f) => f.baseName + f.extension === fileError.filename,
            );
            if (row) row.serverError = fileError.error;
            return row === undefined;
        });
        if (fileErrors === undefined) {
            errorMessage.value = getDialogErrorMessage(error);
        } else if (unmatched.length > 0) {
            errorMessage.value = unmatched
                .map((fileError) => `${fileError.filename}: ${fileError.error}`)
                .join(' ');
        }
        return;
    } finally {
        running.value = false;
    }
    onDialogOK(renameMap);
}
</script>
