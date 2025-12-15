<template>
    <q-dialog ref="dialogRef" @hide="onDialogHide">
        <q-card class="q-dialog-plugin" style="min-width: 500px">
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
                                !isValidNamePart(file.newNamePart)
                            "
                            :error-message="
                                file.error ||
                                (isValidNamePart(file.newNamePart)
                                    ? ''
                                    : 'Invalid characters in filename')
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
    FILENAME_MAX_LENGTH,
    isValidFileNamePart,
    splitFileName,
} from '@kleinkram/validation/frontend';
import { useDialogPluginComponent } from 'quasar';
import { computed, defineComponent, PropType, ref } from 'vue';

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
                return {
                    originalName: f.filename,
                    newNamePart: name,
                    extension,
                    serverError: f.error,
                    error: '',
                };
            }),
        );

        const isValid = computed(() => {
            return localFiles.value.every(
                (f) =>
                    f.newNamePart.trim().length > 0 &&
                    isValidFileNamePart(f.newNamePart) &&
                    f.newNamePart.length + f.extension.length <=
                        FILENAME_MAX_LENGTH,
            );
        });

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
            isValidNamePart: isValidFileNamePart,
            isValid,
            onOKClick,
        };
    },
});
</script>
