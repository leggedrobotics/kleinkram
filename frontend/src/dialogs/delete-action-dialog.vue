<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete Action</template>
        <template #content>
            <delete-action
                v-if="action"
                ref="deleteActionReference"
                :action="action"
            />
            <q-skeleton v-else height="250px" />
        </template>

        <template #actions>
            <q-btn
                flat
                :disable="
                    deleteActionReference?.action_name_check !==
                    action?.template.name
                "
                label="Delete Action"
                class="bg-button-primary"
                @click="deleteActionAction"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { ref } from 'vue';

import { ActionDto } from '@api/types/actions/action.dto';
import DeleteAction from 'components/delete-action.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const deleteActionReference = ref<
    InstanceType<typeof DeleteAction> | undefined
>(undefined);

const { action } = defineProps<{
    action: ActionDto;
}>();

const deleteActionAction = (): void => {
    if (deleteActionReference.value === undefined) return;
    deleteActionReference.value.deleteActionAction();
    onDialogOK();
};
</script>
