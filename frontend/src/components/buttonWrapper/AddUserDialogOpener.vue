<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
        @click="openAddUser"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            Only the creator can add User. You are not the creator.
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, Ref, ref } from 'vue';
import { getUser } from 'src/services/auth';
import AddUserToAccessGroupDialog from 'src/dialogs/AddUserToAccessGroupDialog.vue';
import { UserRole } from '@common/enum';

const $q = useQuasar();
const props = defineProps<{
    accessGroup: AccessGroup;
}>();

const me: Ref<User | undefined> = ref(undefined);
await getUser()?.then((user) => {
    me.value = user;
});

const canModify = computed(() => {
    if (!me.value) return false;
    if (me.value.role === UserRole.ADMIN) {
        return true;
    }
    return props.accessGroup.creator?.uuid === me.value.uuid;
});

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

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>

<style scoped></style>
