<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="creating"
        :dirty="dirty"
        :submit-disabled="creating"
        @submit="createMetadataTypeAction"
    >
        <template #title>New Metadata Type</template>

        <template #content>
            <q-form ref="formReference" greedy @submit.prevent>
                <label :for="nameId">
                    Name<span class="text-error">*</span>
                </label>
                <q-input
                    v-model="metadataTypeName"
                    :for="nameId"
                    placeholder="e.g. weather"
                    outlined
                    dense
                    autofocus
                    no-error-icon
                    color="button-primary"
                    lazy-rules
                    :rules="[
                        (value: string) => !!value || 'Name is required.',
                        (value: string) =>
                            isValidName(value) ||
                            'Between 3 and 50 characters.',
                    ]"
                    :error="serverNameError ? true : undefined"
                    :error-message="serverNameError || undefined"
                    @update:model-value="clearServerNameError"
                />

                <label :for="typeId">
                    Type<span class="text-error">*</span>
                </label>
                <DataTypeDropdown
                    v-model="selectedDataType"
                    :for="typeId"
                    :error="typeMissing && selectedDataType === undefined"
                    error-message="Type is required."
                />
            </q-form>
        </template>

        <template #actions>
            <q-btn
                flat
                no-caps
                label="Create Type"
                class="bg-button-primary"
                :loading="creating"
                @click="createMetadataTypeAction"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { MetadataTypeDto } from '@kleinkram/api-dto/types/metadata/metadata.dto';
import { DataType } from '@kleinkram/shared';
import { useQueryClient } from '@tanstack/vue-query';
import DataTypeDropdown from 'components/metadata/data-type-dropdown.vue';
import { Notify, QForm, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import {
    focusField,
    getDialogErrorMessage,
    getErrorMessage,
    isNameError,
} from 'src/services/error-handling';
import { createMetadataType } from 'src/services/mutations/metadata';
import { computed, ref, useId } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const queryClient = useQueryClient();

const nameId = `metadata-type-name-${useId()}`;
const typeId = `metadata-type-type-${useId()}`;
const metadataTypeName = ref('');
const selectedDataType = ref<DataType | undefined>(undefined);
const creating = ref(false);
const errorMessage = ref('');
// the server rejected the name, e.g. this type already exists
const serverNameError = ref('');
const clearServerNameError = (): void => {
    serverNameError.value = '';
};

const isValidName = (value: string): boolean =>
    value.length >= 3 && value.length <= 50;

const dirty = computed(
    () => metadataTypeName.value !== '' || selectedDataType.value !== undefined,
);
const formReference = ref<QForm>();
// the type was not chosen when the form was submitted
const typeMissing = ref(false);

async function createMetadataTypeAction(): Promise<void> {
    if (creating.value) return;
    typeMissing.value = selectedDataType.value === undefined;
    const valid = await formReference.value?.validate(true);
    if (!valid || typeMissing.value) return;
    creating.value = true;
    errorMessage.value = '';
    let created: MetadataTypeDto;
    try {
        created = (await createMetadataType(
            metadataTypeName.value,
            selectedDataType.value ?? DataType.STRING,
        )) as MetadataTypeDto;
    } catch (error: unknown) {
        if (isNameError(error)) {
            serverNameError.value = getErrorMessage(error);
            focusField(nameId);
        } else {
            errorMessage.value = getDialogErrorMessage(error);
        }
        return;
    } finally {
        creating.value = false;
    }

    Notify.create({
        message: `Metadata ${metadataTypeName.value} created`,
        color: 'positive',
        spinner: false,
        timeout: 4000,
        position: 'bottom',
    });
    // the caller may use the new type, e.g. require it on a project
    onDialogOK(created);
    await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'metadataTypes',
    });
}
</script>
