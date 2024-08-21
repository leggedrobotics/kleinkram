<template>
    <base-dialog ref="dialogRef">
        <template #title> Create File</template>

        <template #content>
            <create-file :mission="mission" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Create File"
                class="bg-button-primary"
                @click="onDialogOK"
            />
        </template>
    </base-dialog>
    >
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import CreateFile from 'components/CreateFile.vue';
import { Mission } from 'src/types/Mission';
import BaseDialog from 'src/dialogs/BaseDialog.vue';

const props = defineProps<{
    mission?: Mission;
}>();
const { dialogRef, onDialogOK } = useDialogPluginComponent();
</script>
