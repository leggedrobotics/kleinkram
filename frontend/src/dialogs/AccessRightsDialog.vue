<template>
    <base-dialog ref="dialogRef">
        <template #title> Project Access Rights</template>

        <template #content>
            <AccessRights :project_uuid="props.project_uuid" />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import AccessRights from 'components/AccessRights.vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/BaseDialog.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    project_uuid: string;
}>();
</script>

<style scoped></style>
