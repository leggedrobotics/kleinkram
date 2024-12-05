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
import AddUserToAccessGroupDialog from '../../dialogs/add-user-access-group-dialog.vue';
import { UserRole } from '@common/enum';
import { AccessGroupDto, CurrentAPIUserDto } from '@api/types/User.dto';

const $q = useQuasar();
const properties = defineProps<{
    accessGroup: AccessGroupDto;
}>();

const me: Ref<CurrentAPIUserDto | undefined> = ref(undefined);
await getUser().then((user) => {
    me.value = user ?? undefined;
});

const canModify = computed(() => {
    if (!me.value) return false;
    if (me.value.role === UserRole.ADMIN) {
        return true;
    }
    return properties.accessGroup.creator?.uuid === me.value.uuid;
});

function openAddUser(): void {
    if (!canModify.value) {
        return;
    }
    $q.dialog({
        component: AddUserToAccessGroupDialog,
        componentProps: {
            access_group_uuid: properties.accessGroup.uuid,
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
