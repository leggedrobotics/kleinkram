<template>
    <base-dialog ref="dialogRef">
        <template #title>
            {{
                isArchiving
                    ? 'Archive Action Template'
                    : 'Delete Action Template'
            }}
        </template>
        <template #content>
            <DeleteActionTemplate
                v-if="template"
                ref="deleteActionReference"
                :template="template"
            />
            <q-skeleton v-else height="200px" />
        </template>

        <template #actions>
            <q-btn
                flat
                :disable="deleteActionReference?.nameCheck !== template?.name"
                :label="isArchiving ? 'Archive' : 'Delete'"
                class="bg-button-danger"
                @click="onConfirm"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { ActionTemplateDto } from '@kleinkram/api-dto/types/actions/action-template.dto';
import DeleteActionTemplate from 'components/actions/delete-action-template.vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { computed, ref } from 'vue';

const props = defineProps<{
    template: ActionTemplateDto;
}>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const deleteActionReference = ref<
    InstanceType<typeof DeleteActionTemplate> | undefined
>(undefined);

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const isArchiving = computed(() => (props.template?.executionCount ?? 0) > 0);

const onConfirm = async (): Promise<void> => {
    if (!deleteActionReference.value) return;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (deleteActionReference.value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (deleteActionReference.value as any).executeAction();
    }
    onDialogOK();
};
</script>
