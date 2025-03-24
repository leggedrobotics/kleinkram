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
    />

    <br />
    <label>Metadata Type</label>
    <q-btn-dropdown
        v-model="ddrOpen"
        class="q-uploader--bordered full-width q-mb-lg"
        flat
        clearable
        required
    >
        <template #label>
            <div class="row items-center justify-between full-width">
                <span :class="selectedDataType ? '' : 'text-placeholder'">
                    {{ selectedDataType ?? 'Data Type (e.g., String)' }}
                </span>
                <q-icon
                    v-if="selectedDataType"
                    :name="icon(selectedDataType)"
                    class="q-ml-sm"
                />
            </div>
        </template>

        <q-list>
            <q-item
                v-for="[datatype, value] in Object.entries(DataType).filter(
                    // filter out the ANY type
                    (item) => item[0] !== DataType.ANY.toString(),
                )"
                :key="datatype"
                clickable
                @click="
                    () => {
                        selectedDataType = value;
                        ddrOpen = false;
                    }
                "
            >
                <q-item-section>
                    <q-item-label v-html="datatype" />
                </q-item-section>
                <q-item-section side>
                    <q-icon
                        :name="icon(datatype as DataType)"
                        class="q-mr-sm"
                    />
                </q-item-section>
            </q-item>
        </q-list>
    </q-btn-dropdown>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { createTagType } from 'src/services/mutations/tag';
import { DataType } from '@common/enum';
import { icon } from 'src/services/generic';

const tagName = ref('');
const selectedDataType = ref<DataType | undefined>(undefined);
const queryClient = useQueryClient();
const ddrOpen = ref(false);

const createTagTypeAction = async (): Promise<boolean> => {
    // validate the tag name (min 3 characters, max 50 characters)
    if (tagName.value.length < 3 || tagName.value.length > 50) {
        Notify.create({
            message: 'Metadata name must be between 3 and 50 characters',
            color: 'negative',
            spinner: false,
            timeout: 4000,
            position: 'bottom',
        });
        return false;
    }

    // validate tag type
    if (!selectedDataType.value && selectedDataType.value !== DataType.ANY) {
        Notify.create({
            message: 'Please select a Metadata Type',
            color: 'negative',
            spinner: false,
            timeout: 4000,
            position: 'bottom',
        });
        return false;
    }

    try {
        await createTagType(
            tagName.value,
            selectedDataType.value ?? DataType.STRING,
        );
    } catch (error: unknown) {
        let errorMessage = '';

        errorMessage =
            error instanceof Error
                ? error.message
                : ((error as { response?: { data?: { message?: string } } })
                      .response?.data?.message ?? 'Unknown error');

        Notify.create({
            message: `Error creating Metadata: ${errorMessage}`,
            color: 'negative',
            spinner: false,
            timeout: 4000,
            position: 'bottom',
        });
        return;
    }
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
};

defineExpose({ createTagTypeAction });
</script>
<style scoped></style>
