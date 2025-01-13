<template>
    <div :class="classObject" @click="openAddUser">
        <slot />
        <q-tooltip v-if="!canModify">
            You don't have permission to modify this group.
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed, reactive } from 'vue';
import AddUserToAccessGroupDialog from '../../dialogs/add-user-access-group-dialog.vue';
import { UserRole } from '@common/enum';
import { AccessGroupDto } from '@api/types/user.dto';
import { useUser } from '../../hooks/query-hooks';

const $q = useQuasar();
const { accessGroup } = defineProps<{ accessGroup: AccessGroupDto }>();

const { data: user } = useUser();

const canModify = computed(() => {
    if (!user.value) return false;
    if (user.value.role === UserRole.ADMIN) {
        return true;
    }
    return accessGroup.memberships.some(
        (m) => m.user.uuid === user.value.uuid && m.canEditGroup,
    );
});

const classObject = reactive({
    disabled: !canModify.value,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'cursor-pointer': !canModify.value,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'cursor-not-allowed': canModify.value,
});

function openAddUser(): void {
    if (!canModify.value) {
        return;
    }
    $q.dialog({
        component: AddUserToAccessGroupDialog,
        componentProps: {
            accessGroupUuid: accessGroup.uuid,
        },
    });
}
</script>

<style scoped>
/* used as conditional styling */
.disabled {
    opacity: 0.5;
}
</style>

<style scoped></style>
