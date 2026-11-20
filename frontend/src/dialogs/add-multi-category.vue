<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="isPending"
        fixed-height
        size="lg"
        :dirty="selected.length > 0"
        :submit-disabled="selected.length === 0 || creating || isPending"
        @submit="addCategories"
    >
        <template #title>Add Categories</template>
        <template #tabs>
            <q-tabs
                v-model="tab"
                dense
                align="left"
                active-color="button-primary"
                indicator-color="button-primary"
            >
                <q-tab name="add" label="Add" />
                <q-tab name="create" label="Manage Categories" />
            </q-tabs>
        </template>
        <template #content>
            <div class="dialog-tab-panels">
                <div
                    role="tabpanel"
                    class="dialog-tab-panel"
                    :class="{ 'dialog-tab-panel--active': tab === 'add' }"
                    :inert="tab !== 'add'"
                >
                    <category-selector
                        :selected="selected"
                        :project-uuid="projectUuid"
                        @update:selected="updateSelected"
                        @update:creating="updateCreating"
                    />
                </div>
                <div
                    role="tabpanel"
                    class="dialog-tab-panel"
                    :class="{ 'dialog-tab-panel--active': tab === 'create' }"
                    :inert="tab !== 'create'"
                >
                    <CategoryManager :project-uuid="projectUuid" />
                </div>
            </div>
        </template>
        <template #actions>
            <span class="disabled-reason">
                <q-btn
                    flat
                    no-caps
                    label="Add Categories"
                    class="bg-button-primary"
                    :disable="selected.length === 0"
                    :loading="isPending || creating"
                    @click="addCategories"
                />
                <q-tooltip v-if="selected.length === 0"
                    >Select at least one category</q-tooltip
                >
            </span>
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import type { CategoryDto } from '@kleinkram/api-dto/types/category.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { getDialogErrorMessage } from 'src/services/error-handling';
import { addManyCategories } from 'src/services/mutations/categories';
import { Ref, ref } from 'vue';

import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import CategoryManager from 'components/category-manager.vue';
import CategorySelector from 'components/category-selector.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { missionUuid, projectUuid, files } = defineProps<{
    missionUuid: string;
    projectUuid: string;
    files: FileWithTopicDto[];
}>();
const queryClient = useQueryClient();
const selected: Ref<CategoryDto[]> = ref<CategoryDto[]>([]);
const errorMessage = ref('');

const tab = ref('add');

const updateSelected = (value: CategoryDto[]): void => {
    selected.value = value;
};

// a category typed in the selector is still being created: saving now
// would leave it out
const creating = ref(false);
const updateCreating = (value: boolean): void => {
    creating.value = value;
};

const { mutate, isPending } = useMutation({
    mutationFn: () =>
        addManyCategories(
            missionUuid,
            files.map((f) => f.uuid),
            selected.value.map((c) => c.uuid),
        ),
    onSuccess: async () => {
        Notify.create({
            message: 'Categories added',
            color: 'positive',
            position: 'bottom',
        });
        onDialogOK();
        await queryClient.invalidateQueries({
            queryKey: ['files'],
        });
    },
    onError: (error: Error) => {
        errorMessage.value = getDialogErrorMessage(error);
    },
});

const addCategories = (): void => {
    if (selected.value.length === 0 || isPending.value || creating.value)
        return;
    errorMessage.value = '';
    mutate();
};
</script>
