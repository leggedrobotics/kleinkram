<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="error"
        :busy="isPending"
        size="lg"
    >
        <template #title>Add Projects to Access Group</template>

        <template #content>
            <AddProjectToAccessGroup
                ref="addProjectReference"
                v-model:count="count"
                :access-group-uuid="accessGroupUuid"
            />
        </template>

        <template #actions>
            <span class="disabled-reason">
                <q-btn
                    flat
                    no-caps
                    :label="addLabel"
                    class="bg-button-primary"
                    :disable="count === 0 || isPending"
                    :loading="isPending"
                    @click="add"
                />
                <q-tooltip v-if="count === 0"
                    >Select at least one project</q-tooltip
                >
            </span>
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import AddProjectToAccessGroup from 'components/add-project-access-group.vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { getDialogErrorMessage } from 'src/services/error-handling';
import { computed, ref } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const addProjectReference = ref<
    InstanceType<typeof AddProjectToAccessGroup> | undefined
>(undefined);

const { accessGroupUuid } = defineProps<{
    accessGroupUuid: string;
}>();

const error = ref('');
const count = ref(0);
const isPending = ref(false);

// "Add Project" for one, "Add 3 Projects" for several
const addLabel = computed(() => {
    if (count.value === 0) return 'Add Projects';
    if (count.value === 1) return 'Add Project';
    return `Add ${String(count.value)} Projects`;
});

const add = async (): Promise<void> => {
    if (!addProjectReference.value || count.value === 0) return;
    error.value = '';
    isPending.value = true;
    try {
        await addProjectReference.value.mutateAsync();
        onDialogOK();
    } catch (error_: unknown) {
        error.value = getDialogErrorMessage(error_);
    } finally {
        isPending.value = false;
    }
};
</script>
