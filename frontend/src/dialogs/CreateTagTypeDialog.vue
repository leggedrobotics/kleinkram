<template>
    <base-dialog ref="dialogRef">
        <template #title> Create Tag Type</template>

        <template #content>
            <create-tag-type ref="createTagType" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Create Tag Type"
                class="bg-button-primary"
                @click="
                    () => {
                        createTagType?.createTagTypeAction();
                        onDialogOK();
                    }
                "
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { ref } from 'vue';

const createTagType = ref();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
</script>
