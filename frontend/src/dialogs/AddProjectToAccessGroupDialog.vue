<template>
    <base-dialog ref="dialogRef">
        <template #title> Add Project to Access Group</template>

        <template #content>
            <AddProjectToAccessGroupDialog :access_group="props.access_group" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Add Project"
                class="bg-button-primary"
                @click="onDialogOK"
            />
        </template>
    </base-dialog>
    >
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import AddProjectToAccessGroupDialog from 'src/components/AddProjectToAccessGroup.vue';
import BaseDialog from 'src/dialogs/BaseDialog.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    access_group: string;
}>();
</script>

<style scoped></style>
