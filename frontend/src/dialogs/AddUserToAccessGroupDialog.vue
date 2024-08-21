<template>
    <base-dialog ref="dialogRef">
        <template #title> Add User to Access Group</template>

        <template #content>
            <AddUserToAccessGroup :access_group="props.access_group" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Add User"
                class="bg-button-primary"
                @click="onDialogOK"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import AddUserToAccessGroup from 'components/AddUserToAccessGroup.vue';
import BaseDialog from 'src/dialogs/BaseDialog.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    access_group: string;
}>();
</script>

<style scoped></style>
