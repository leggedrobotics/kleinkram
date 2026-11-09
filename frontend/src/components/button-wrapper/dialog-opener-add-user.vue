<template>
    <div
        v-if="canModify"
        class="cursor-pointer"
        style="height: 100%"
        @click="openAddUser"
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
import type { AccessGroupDto } from '@kleinkram/api-dto/types/access-control/access-group.dto';
import { UserRole } from '@kleinkram/shared';
import { useQuasar } from 'quasar';
import AddUserToAccessGroupDialog from 'src/dialogs/add-user-access-group-dialog.vue';
import { useUser } from 'src/hooks/query-hooks';
import { computed } from 'vue';

const $q = useQuasar();
const { accessGroup } = defineProps<{ accessGroup: AccessGroupDto }>();

const { data: user } = useUser();

const canModify = computed(() => {
    if (!user.value) return false;
    if (user.value.role === UserRole.ADMIN) {
        return true;
    }
    return accessGroup.memberships.some(
        (m) => m.user.uuid === user.value?.uuid && m.canEditGroup,
    );
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
