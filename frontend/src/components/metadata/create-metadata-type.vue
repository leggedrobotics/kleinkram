<template>
    <label>Metadata Name</label>
    <q-input
        v-model="metadataTypeName"
        placeholder="e.g., Location of Mission"
        outlined
        dense
        clearable
        required
        autofocus
        :error="nameError !== ''"
        :error-message="nameError"
        @update:model-value="handleNameUpdate"
    />

    <br />
    <label>Metadata Type</label>
    <DataTypeDropdown
        v-model="selectedDataType"
        :error="dataTypeError !== ''"
        :error-message="dataTypeError"
    />
</template>

<script setup lang="ts">
import { DataType } from '@kleinkram/shared';
import { useQueryClient } from '@tanstack/vue-query';
import DataTypeDropdown from 'components/metadata/data-type-dropdown.vue';
import { Notify } from 'quasar';
import { createMetadataType } from 'src/services/mutations/metadata';
import { ref } from 'vue';

const metadataTypeName = ref('');
const selectedDataType = ref<DataType | undefined>(undefined);
const queryClient = useQueryClient();
const nameError = ref('');
const dataTypeError = ref('');

const notifyError = (message: string): false => {
    Notify.create({
        message,
        color: 'negative',
        spinner: false,
        timeout: 4000,
        position: 'bottom',
    });
    return false;
};

/**
 * This explicitly sets the metadata type name to an empty string if the new value is null.
 * e.g. when the clear button is clicked
 *
 * @param newValue
 */
const handleNameUpdate = (newValue: string | null | number): void => {
    if (newValue === null) {
        metadataTypeName.value = '';
    }
};

const createMetadataTypeAction = async (): Promise<boolean> => {
    // Validate metadata type name
    if (
        metadataTypeName.value.length < 3 ||
        metadataTypeName.value.length > 50
    ) {
        nameError.value = 'Metadata name must be between 3 and 50 characters';
        dataTypeError.value = '';
        return false;
    } else {
        nameError.value = '';
    }

    // Validate data type
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!selectedDataType.value && selectedDataType.value !== DataType.ANY) {
        dataTypeError.value = 'Please select a Metadata Type';
        return false;
    } else {
        dataTypeError.value = '';
    }

    try {
        await createMetadataType(
            metadataTypeName.value,
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            selectedDataType.value ?? DataType.STRING,
        );

        await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'metadataTypes',
        });

        Notify.create({
            message: `Metadata ${metadataTypeName.value} created`,
            color: 'positive',
            spinner: false,
            timeout: 4000,
            position: 'bottom',
        });

        metadataTypeName.value = '';
        selectedDataType.value = DataType.STRING;
        return true;
    } catch (error: unknown) {
        let errorMessage = 'Unknown error';

        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (
            typeof error === 'object' &&
            error !== null &&
            'response' in error &&
            typeof error.response === 'object' &&
            error.response !== null &&
            'data' in (error as { response: { data: unknown } }).response &&
            typeof (error as { response: { data: unknown } }).response.data ===
                'object' &&
            (error as { response: { data: unknown } }).response.data !== null &&
            'message' in
                (error as { response: { data: { message: string } } }).response
                    .data
        ) {
            errorMessage = (
                error as { response: { data: { message: string } } }
            ).response.data.message;
        }

        return notifyError(`Error creating Metadata: ${errorMessage}`);
    }
};

defineExpose({ createMetadataTypeAction });
</script>
