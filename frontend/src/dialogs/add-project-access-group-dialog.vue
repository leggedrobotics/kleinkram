<template>
    <base-dialog ref="dialogRef">
        <template #title> Add Project to Access Group</template>

        <template #content>
            <AddProjectToAccessGroupDialog
                ref="addProjectReference"
                :access_group_uuid="access_group_uuid"
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Confirm"
                class="bg-button-primary"
                @click="addProjectToAccessGroupAction"
            />
        </template>
    </base-dialog>
    >
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import AddProjectToAccessGroupDialog from '@components/add-project-access-group.vue';
import BaseDialog from './base-dialog.vue';
import { ref } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const addProjectReference = ref<
    InstanceType<typeof AddProjectToAccessGroupDialog> | undefined
>(undefined);

const { access_group_uuid } = defineProps<{
    access_group_uuid: string;
}>();

const addProjectToAccessGroupAction = (): void => {
    addProjectReference.value?.mutate();
    onDialogOK();
};
</script>

<style scoped></style>
