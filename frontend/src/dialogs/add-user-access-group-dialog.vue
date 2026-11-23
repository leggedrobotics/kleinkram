<template>
    <base-dialog ref="dialogRef" v-model:error="error" :busy="isPending">
        <template #title>Add Users to Access Group</template>

        <template #content>
            <AddUserToAccessGroup
                ref="addUserReference"
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
                    >Select at least one user</q-tooltip
                >
            </span>
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import AddUserToAccessGroup from 'components/add-user-access-group.vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { getDialogErrorMessage } from 'src/services/error-handling';
import { computed, ref } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const addUserReference = ref<
    InstanceType<typeof AddUserToAccessGroup> | undefined
>(undefined);

const { accessGroupUuid } = defineProps<{
    accessGroupUuid: string;
}>();

const error = ref('');
const count = ref(0);
const isPending = ref(false);

// "Add User" for one, "Add 3 Users" for several
const addLabel = computed(() => {
    if (count.value === 0) return 'Add Users';
    if (count.value === 1) return 'Add User';
    return `Add ${String(count.value)} Users`;
});

const add = async (): Promise<void> => {
    if (!addUserReference.value || count.value === 0) return;
    error.value = '';
    isPending.value = true;
    try {
        await addUserReference.value.mutateAsync();
        onDialogOK();
    } catch (error_: unknown) {
        error.value = getDialogErrorMessage(error_);
    } finally {
        isPending.value = false;
    }
};
</script>
