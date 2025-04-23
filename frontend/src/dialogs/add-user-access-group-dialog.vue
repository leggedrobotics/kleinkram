<template>
    <base-dialog ref="dialogRef">
        <template #title>Add User to Access Group</template>

        <template #content>
            <AddUserToAccessGroup
                ref="addUserReference"
                :access-group-uuid="accessGroupUuid"
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Confirm"
                class="bg-button-primary"
                @click="addUserToAccessGroupAction"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from './base-dialog.vue';
import { ref } from 'vue';
import AddUserToAccessGroup from '@components/add-user-access-group.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const addUserReference = ref<InstanceType<typeof AddUserToAccessGroup> | null>(
    // TODO: check why we need null as a value
    // eslint-disable-next-line unicorn/no-null
    null,
);

const { accessGroupUuid } = defineProps<{
    accessGroupUuid: string;
}>();

const addUserToAccessGroupAction = (): void => {
    addUserReference.value?.mutate();
    onDialogOK();
};
</script>

<style scoped></style>
