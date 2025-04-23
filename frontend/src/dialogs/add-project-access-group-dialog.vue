<template>
    <base-dialog ref="dialogRef">
        <template #title> Add Project to Access Group</template>

        <template #content>
            <AddProjectToAccessGroupDialog
                ref="addProjectReference"
                :access-group-uuid="accessGroupUuid"
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
import AddProjectToAccessGroupDialog from 'components/add-project-access-group.vue';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { ref } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const addProjectReference = ref<
    InstanceType<typeof AddProjectToAccessGroupDialog> | undefined
>(undefined);

const { accessGroupUuid } = defineProps<{
    accessGroupUuid: string;
}>();

const addProjectToAccessGroupAction = (): void => {
    addProjectReference.value?.mutate();
    onDialogOK();
};
</script>

<style scoped></style>
