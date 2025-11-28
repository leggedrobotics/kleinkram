<template>
    <base-dialog ref="dialogRef">
        <template #title>
            {{ isArchiving ? 'Archive Action Template' : 'Delete Action Template' }}
        </template>
        <template #content>
            <DeleteActionTemplate
                v-if="template"
                ref="deleteActionRef"
                :template="template"
            />
            <q-skeleton v-else height="200px" />
        </template>

        <template #actions>
            <q-btn
                flat
                :disable="deleteActionRef?.nameCheck !== template?.name"
                :label="isArchiving ? 'Archive' : 'Delete'"
                class="bg-button-danger"
                @click="onConfirm"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { ActionTemplateDto } from '@api/types/actions/action-template.dto';
import DeleteActionTemplate from 'components/actions/delete-action-template.vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { computed, ref } from 'vue';

const props = defineProps<{
    template: ActionTemplateDto;
}>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const deleteActionRef = ref<InstanceType<typeof DeleteActionTemplate> | undefined>(
    undefined,
);

const isArchiving = computed(() => (props.template?.executionCount ?? 0) > 0);

const onConfirm = async (): Promise<void> => {
    if (!deleteActionRef.value) return;
    await deleteActionRef.value.executeAction();
    onDialogOK();
};
</script>
