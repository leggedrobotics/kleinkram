<template>
    <base-dialog ref="dialogRef">
        <template #title>Add Categories</template>
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
                        :project_uuid="project_uuid"
                        @update:selected="updateSelected"
                    />
                </q-tab-panel>
                <q-tab-panel name="create" style="min-height: 180px">
                    <CategoryCreator :project_uuid="project_uuid" />
                </q-tab-panel>
            </q-tab-panels>
        </template>
        <template #actions>
            <q-btn
                label="Save"
                class="bg-button-primary"
                @click="addCategories"
                :disable="selected.length === 0"
        /></template>
    </base-dialog>
</template>
<script setup lang="ts">
import { Notify, useDialogPluginComponent } from 'quasar';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { Ref, ref } from 'vue';
import { FileEntity } from 'src/types/FileEntity';
import { Category } from 'src/types/Category';
import CategorySelector from 'components/CategorySelector.vue';
import CategoryCreator from 'components/CategoryCreator.vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { addManyCategories } from 'src/services/mutations/categories';

const props = defineProps<{
    mission_uuid: string;
    project_uuid: string;
    files: FileEntity[];
}>();
const queryClient = useQueryClient();
const selected: Ref<Category[]> = ref<Category[]>([]);

const tab = ref('add');
function updateSelected(value: Category[]) {
    selected.value = value;
}

const { mutate } = useMutation({
    mutationFn: () => {
        addManyCategories(
            props.mission_uuid,
            props.files.map((f) => f.uuid),
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
        await queryClient.invalidateQueries(['files']);
    },
    onError: (error: Error) => {
        Notify.create({
            message: error.message,
            color: 'negative',
            position: 'bottom',
        });
    },
});
function addCategories() {
    mutate();
}
</script>
<style scoped></style>
