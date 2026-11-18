<template>
    <q-dialog ref="dialogRef" @hide="onDialogHide">
        <q-card class="q-dialog-plugin rename-files-card">
            <q-card-section>
                <div class="text-h6">Invalid Filenames</div>
                <div class="text-caption text-grey">
                    The following files have invalid names. Please rename them
                    to proceed.
                </div>
            </q-card-section>

            <q-card-section class="q-pt-none">
                <div
                    v-for="(file, index) in localFiles"
                    :key="index"
                    class="q-mb-md"
                >
                    <div class="row items-baseline">
                        <q-input
                            v-model="file.newNamePart"
                            :label="`Rename '${file.originalName}'`"
                            :error="
                                !!file.error ||
                                !!nameError(file.newNamePart + file.extension)
                            "
                            :error-message="
                                file.error ||
                                nameError(file.newNamePart + file.extension)
                            "
                            dense
                            outlined
                            class="col-grow"
                            @update:model-value="() => (file.error = '')"
                        />
                        <div class="q-ml-sm text-grey text-body1">
                            {{ file.extension }}
                        </div>
                    </div>
                    <div
                        v-if="file.serverError"
                        class="text-negative text-caption q-mt-xs"
                    >
                        {{ file.serverError }}
                    </div>
                </div>
            </q-card-section>

            <q-card-actions align="right">
                <q-btn
                    color="primary"
                    label="Cancel"
                    flat
                    @click="onDialogCancel"
                />
                <q-btn
                    color="primary"
                    label="Retry Upload"
                    :disable="!isValid"
                    @click="onOKClick"
                />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>

<script lang="ts">
import {
    FILE_EXTENSIONS,
    getFileNameValidationError,
    splitFileName,
} from '@kleinkram/validation/frontend';
import { useDialogPluginComponent } from 'quasar';
import { computed, defineComponent, PropType, ref } from 'vue';

// the rules of `packages/validation/src/filename.validation.ts`, as on the server
const nameError = (filename: string): string =>
    getFileNameValidationError(filename) ?? '';

export interface InvalidFile {
    filename: string;
    error: string;
}

export default defineComponent({
    name: 'RenameFilesDialog',
    props: {
        invalidFiles: {
            type: Array as PropType<InvalidFile[]>,
            required: true,
        },
    },
    emits: [...useDialogPluginComponent.emits],
    setup(props) {
        const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
            useDialogPluginComponent();

        const localFiles = ref(
            props.invalidFiles.map((f) => {
                const { name, extension } = splitFileName(f.filename);
                // the server only accepts lowercase extensions
                const lowerExtension = extension.toLowerCase();
                return {
                    originalName: f.filename,
                    newNamePart: name,
                    extension: FILE_EXTENSIONS.includes(lowerExtension)
                        ? lowerExtension
                        : extension,
                    serverError: f.error,
                    error: '',
                };
            }),
        );

        const isValid = computed(() =>
            localFiles.value.every(
                (f) => nameError(f.newNamePart + f.extension) === '',
            ),
        );

        const onOKClick = () => {
            const renameMap: Record<string, string> = {};
            for (const f of localFiles.value) {
                renameMap[f.originalName] = f.newNamePart + f.extension;
            }
            onDialogOK(renameMap);
        };

        return {
            dialogRef,
            onDialogHide,
            onDialogOK,
            onDialogCancel,
            localFiles,
            nameError,
            isValid,
            onOKClick,
        };
    },
});
</script>

<style scoped>
.rename-files-card {
    min-width: 500px;
}

@media (max-width: 599px) {
    .rename-files-card {
        min-width: 0;
    }
}
</style>
