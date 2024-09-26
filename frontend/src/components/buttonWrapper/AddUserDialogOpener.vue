<template>
    <div
        @click="openAddUser"
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            Only the creator can add User. You are not the creator.
        </q-tooltip>
    </div>
</template>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>

<script setup lang="ts">
import { Notify, useQuasar } from 'quasar';
import { computed, Ref, ref } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { deleteAccessGroup } from 'src/services/mutations/access';
import { AccessGroup } from 'src/types/AccessGroup';
import { getUser } from 'src/services/auth';
import { User } from 'src/types/User';
import ROLE from 'src/enums/USER_ROLES';
import AddUserToAccessGroupDialog from 'src/dialogs/AddUserToAccessGroupDialog.vue';

const $q = useQuasar();
const props = defineProps<{
    accessGroup: AccessGroup;
}>();

const me: Ref<User | undefined> = ref(undefined);
getUser()?.then((user) => {
    me.value = user;
});

const canModify = computed(() => {
    if (!me.value) return false;
    if (me.value.role === ROLE.ADMIN) {
        return true;
    }
    return props.accessGroup.creator?.uuid === me.value.uuid;
});
const queryClient = useQueryClient();

function openAddUser() {
    if (!canModify.value) {
        return;
    }
    $q.dialog({
        component: AddUserToAccessGroupDialog,
        componentProps: {
            access_group_uuid: props.accessGroup.uuid,
        },
    });
}
</script>

<style scoped></style>
