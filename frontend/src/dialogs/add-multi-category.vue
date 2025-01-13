<template>
    <base-dialog ref="dialogRef">
        <template #title> Add Categories </template>
        <template #tabs>
            <q-tabs
                v-model="tab"
                dense
                class="text-grey"
                align="left"
                active-color="primary"
            >
                <q-tab name="add" label="Add" style="color: #222" />
                <q-tab
                    name="create"
                    label="Create Categories"
                    style="color: #222"
                />
            </q-tabs>
        </template>
        <template #content>
            <q-tab-panels v-model="tab">
                <q-tab-panel name="add" style="min-height: 180px">
                    <label for="categoryName">Select Categories</label>
                    <category-selector
                        :selected="selected"
                        :project_uuid="projectUuid"
                        @update:selected="updateSelected"
                    />
                </q-tab-panel>
                <q-tab-panel name="create" style="min-height: 180px">
                    <CategoryCreator :project_uuid="projectUuid" />
                </q-tab-panel>
            </q-tab-panels>
        </template>
        <template #actions>
            <q-btn
                label="Save"
                class="bg-button-primary"
                :disable="selected.length === 0"
                @click="addCategories"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from './base-dialog.vue';
import { Ref, ref } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { addManyCategories } from 'src/services/mutations/categories';
import { CategoryDto } from '@api/types/category.dto';

import { FileWithTopicDto } from '@api/types/file/file.dto';
import CategorySelector from '@components/category-selector.vue';
import CategoryCreator from '@components/category-creator.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { missionUuid, projectUuid, files } = defineProps<{
    missionUuid: string;
    projectUuid: string;
    files: FileWithTopicDto[];
}>();
const queryClient = useQueryClient();
const selected: Ref<CategoryDto[]> = ref<CategoryDto[]>([]);

const tab = ref('add');

const updateSelected = (value: CategoryDto[]): void => {
    selected.value = value;
};

const { mutate } = useMutation({
    mutationFn: async () => {
        await addManyCategories(
            missionUuid,
            files.map((f) => f.uuid),
            selected.value.map((c) => c.uuid),
        );
        onDialogOK();
    },
    onSuccess: async () => {
        Notify.create({
            message: 'Categories added',
            color: 'positive',
            position: 'bottom',
        });
        await queryClient.invalidateQueries({
            queryKey: ['files'],
        });
    },
    onError: (error: Error) => {
        Notify.create({
            message: error.message,
            color: 'negative',
            position: 'bottom',
        });
    },
});

const addCategories = (): void => {
    mutate();
};
</script>
<style scoped></style>
