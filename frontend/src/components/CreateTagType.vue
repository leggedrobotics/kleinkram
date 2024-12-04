<template>
    <label>Tag Name</label>
    <q-input
        v-model="tagName"
        placeholder="Tag Name"
        outlined
        dense
        clearable
        required
        autofocus
    />

    <br>
    <label>Tag Type</label>
    <q-btn-dropdown
        v-model="ddrOpen"
        :label="selectedDataType || 'Data Type'"
        class="q-uploader--bordered full-width q-mb-lg"
        flat
        clearable
        required
    >
        <q-list>
            <q-item
                v-for="[datatype, value] in Object.entries(DataType)"
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
                    <q-item-label>
                        {{ datatype }}
                    </q-item-label>
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

const tagName = ref('');
const selectedDataType = ref(DataType.STRING);
const queryClient = useQueryClient();
const ddrOpen = ref(false);

const createTagTypeAction = async (): Promise<void> => {
    try {
        await createTagType(tagName.value, selectedDataType.value);
    } catch (error: unknown) {
        let errorMessage = '';

        errorMessage =
            error instanceof Error
                ? error.message
                : ((error as { response?: { data?: { message?: string } } })
                      .response?.data?.message ?? 'Unknown error');

        Notify.create({
            message: `Error creating Tag Type: ${errorMessage}`,
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
        message: `Tag Type ${tagName.value} created`,
        color: 'positive',
        spinner: false,
        timeout: 4000,
        position: 'bottom',
    });
    tagName.value = '';
    selectedDataType.value = DataType.STRING;
};

defineExpose({ createTagTypeAction });
</script>
<style scoped></style>
