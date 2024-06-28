<template>
    <q-card-section>
        <h3 class="text-h6">Create new Tag Type</h3>
        <div class="row justify-between q-gutter-md">
            <div class="col-9">
                <q-form @submit="submitNewTag">
                    <div class="row justify-between">
                        <div class="col-3">
                            <q-input
                                v-model="tagName"
                                label="Tag Type Name"
                                outlined
                                dense
                                clearable
                                required
                            />
                        </div>
                        <div class="col-8">
                            <q-btn-dropdown
                                v-model="ddr_open"
                                :label="selectedDataType || 'Data Type'"
                                outlined
                                dense
                                clearable
                                required
                            >
                                <q-list>
                                    <q-item
                                        v-for="[
                                            datatype,
                                            value,
                                        ] in Object.entries(DataType)"
                                        :key="datatype"
                                        clickable
                                        @click="
                                            selectedDataType = value;
                                            ddr_open = false;
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
                        </div>
                    </div>
                </q-form>
            </div>
            <div class="col-2">
                <q-btn
                    label="Submit"
                    color="primary"
                    @click="submitNewTag"
                    :disable="!tagName"
                />
            </div>
        </div>
    </q-card-section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { createTagType } from 'src/services/mutations';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { DataType } from 'src/enum/TAG_TYPES';

const tagName = ref('');
const selectedDataType = ref(DataType.STRING);
const queryClient = useQueryClient();
const ddr_open = ref(false);

const submitNewTag = async () => {
    try {
        await createTagType(tagName.value, selectedDataType.value);
    } catch (error) {
        console.log(error);
        Notify.create({
            message: `Error creating Tag Type: ${error?.response?.data?.message || error.message}`,
            color: 'negative',
            spinner: false,
            timeout: 4000,
            position: 'top-right',
        });
        return;
    }
    const cache = queryClient.getQueryCache();
    const filtered = cache
        .getAll()
        .filter((query) => query.queryKey[0] === 'tagTypes');
    filtered.forEach((query) => {
        queryClient.invalidateQueries(query.queryKey);
    });
    Notify.create({
        message: `Tag Type ${tagName.value} created`,
        color: 'positive',
        spinner: false,
        timeout: 4000,
        position: 'top-right',
    });
    tagName.value = '';
    selectedDataType.value = DataType.STRING;
};
</script>
<style scoped></style>
