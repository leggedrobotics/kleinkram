<template>
    <label>Metadata Name</label>
    <q-input
        v-model="tagName"
        placeholder="e.g., Location of Mission"
        outlined
        dense
        clearable
        required
        autofocus
        :error="tagNameError !== ''"
        :error-message="tagNameError"
        @update:model-value="handleTagNameUpdate"
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
import { ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { createTagType } from 'src/services/mutations/tag';
import { DataType } from '@common/enum';
import DataTypeDropdown from 'components/metadata/data-type-dropdown.vue';

const tagName = ref('');
const selectedDataType = ref<DataType | undefined>(undefined);
const queryClient = useQueryClient();
const tagNameError = ref('');
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
 * This explicitly sets the tag name to an empty string if the new value is null.
 * e.g. when the clear button is clicked
 *
 * @param newValue
 */
const handleTagNameUpdate = (newValue: string | null | number): void => {
    if (newValue === null) {
        tagName.value = '';
    }
};

const createTagTypeAction = async (): Promise<boolean> => {
    // Validate tag name
    if (tagName.value.length < 3 || tagName.value.length > 50) {
        tagNameError.value =
            'Metadata name must be between 3 and 50 characters';
        dataTypeError.value = '';
        return false;
    } else {
        tagNameError.value = '';
    }

    // Validate tag type
    if (!selectedDataType.value && selectedDataType.value !== DataType.ANY) {
        dataTypeError.value = 'Please select a Metadata Type';
        return false;
    } else {
        dataTypeError.value = '';
    }

    try {
        await createTagType(
            tagName.value,
            selectedDataType.value ?? DataType.STRING,
        );

        await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'tagTypes',
        });

        Notify.create({
            message: `Metadata ${tagName.value} created`,
            color: 'positive',
            spinner: false,
            timeout: 4000,
            position: 'bottom',
        });

        tagName.value = '';
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
            typeof (error as { response: unknown }).response === 'object' &&
            (error as { response: unknown }).response !== null &&
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

defineExpose({ createTagTypeAction });
</script>
