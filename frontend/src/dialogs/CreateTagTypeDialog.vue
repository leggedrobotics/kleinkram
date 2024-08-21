<template>
    <base-dialog ref="dialogRef">
        <template #title> Create Tag Type</template>

        <template #content>
            <create-tag-type />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Create Tag Type"
                class="bg-button-primary"
                @click="onDialogOK"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import CreateTagType from 'components/CreateTagType.vue';
import BaseDialog from 'src/dialogs/BaseDialog.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
</script>
