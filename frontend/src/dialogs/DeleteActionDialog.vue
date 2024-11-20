<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete Action </template>
        <template #content>
            <delete-action
                v-if="action"
                ref="deleteActionRef"
                :action="action"
            />
            <q-skeleton v-else height="250px" />
        </template>

        <template #actions>
            <q-btn
                flat
                :disable="
                    deleteActionRef?.action_name_check !== action?.template.name
                "
                label="Delete Action"
                class="bg-button-primary"
                @click="
                    () => {
                        deleteActionRef?.deleteActionAction();
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
import DeleteAction from 'components/DeleteAction.vue';
import { Action } from 'src/types/Action';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const deleteActionRef = ref<InstanceType<typeof DeleteAction> | null>(null);

const { action } = defineProps({
    action: Action,
});
</script>
