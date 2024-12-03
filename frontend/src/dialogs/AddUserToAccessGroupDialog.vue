<template>
    <base-dialog ref="dialogRef">
        <template #title> Add User to Access Group</template>

        <template #content>
            <AddUserToAccessGroup
                ref="addUserRef"
                :access_group_uuid="props.access_group_uuid"
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
import AddUserToAccessGroup from 'components/AddUserToAccessGroup.vue';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { ref } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const addUserRef = ref<InstanceType<typeof AddUserToAccessGroup> | null>(null);

const props = defineProps<{
    access_group_uuid: string;
}>();

const addUserToAccessGroupAction = (): void => {
    // @ts-ignore
    addUserRef.value?.mutate();
    onDialogOK();
};
</script>

<style scoped></style>
