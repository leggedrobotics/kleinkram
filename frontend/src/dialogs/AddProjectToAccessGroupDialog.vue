<template>
    <base-dialog ref="dialogRef">
        <template #title> Add Project to Access Group</template>

        <template #content>
            <AddProjectToAccessGroupDialog
                ref="addProjectRef"
                :access_group_uuid="props.access_group_uuid"
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
import AddProjectToAccessGroupDialog from 'src/components/AddProjectToAccessGroup.vue';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { ref } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const addProjectRef = ref<InstanceType<
    typeof AddProjectToAccessGroupDialog
> | null>(null);

const props = defineProps<{
    access_group_uuid: string;
}>();

const addProjectToAccessGroupAction = (): void => {
    addProjectRef.value?.mutate();
    onDialogOK();
};
</script>

<style scoped></style>
