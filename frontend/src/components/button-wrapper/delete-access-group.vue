<template>
    <div
        v-if="canModify"
        :class="isPrimary ? 'disabled cursor-not-allowed' : 'cursor-pointer'"
        @click="onClick"
    >
        <slot />
        <q-tooltip v-if="isPrimary">
            You can't delete the primary access group
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import type { AccessGroupDto } from '@kleinkram/api-dto/types/access-control/access-group.dto';
import type { CurrentAPIUserDto } from '@kleinkram/api-dto/types/user/current-api-user.dto';
import { AccessGroupType, UserRole } from '@kleinkram/shared';
import { useQuasar } from 'quasar';
import DeleteAccessGroupDialog from 'src/dialogs/delete-access-group-dialog.vue';
import { getUser } from 'src/services/auth';
import { computed, onMounted, Ref, ref } from 'vue';

const { accessGroup } = defineProps<{ accessGroup: AccessGroupDto }>();

const me: Ref<CurrentAPIUserDto | undefined> = ref(undefined);
onMounted(async () => {
    await getUser().then((user) => {
        me.value = user ?? undefined;
    });
});

const canModify = computed(() => {
    if (me.value === undefined) return false;
    if (me.value.role === UserRole.ADMIN) {
        return true;
    }
    return accessGroup.creator?.uuid === me.value.uuid;
});
const isPrimary = computed(() => accessGroup.type === AccessGroupType.PRIMARY);

const $q = useQuasar();

// deleting a group also removes its access, so it is confirmed first
function onClick(): void {
    if (!canModify.value || isPrimary.value) return;
    $q.dialog({
        component: DeleteAccessGroupDialog,
        componentProps: { accessGroup },
    });
}
</script>
