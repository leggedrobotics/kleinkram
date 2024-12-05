<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete Action</template>
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
                @click="deleteAction"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from './base-dialog.vue';
import { ref } from 'vue';
import DeleteAction from 'components/DeleteAction.vue';

import { ActionDto } from '@api/types/actions/action.dto';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const deleteActionRef = ref<InstanceType<typeof DeleteAction> | null>(null);

const { action } = defineProps<{
    action: ActionDto;
}>();

const deleteAction = (): void => {
    if (deleteActionRef.value === null) return;
    deleteActionRef.value.deleteActionAction();
    onDialogOK();
};
</script>
