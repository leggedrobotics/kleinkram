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
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { getUser } from 'src/services/auth';
import { deleteAccessGroup } from 'src/services/mutations/access';
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
const queryClient = useQueryClient();

const { mutate: _deleteAccessGroup } = useMutation({
    mutationFn: () => deleteAccessGroup(accessGroup.uuid),
    onSuccess: async () => {
        await queryClient.invalidateQueries({
            predicate: (query) => {
                return query.queryKey[0] === 'accessGroups';
            },
        });
        Notify.create({
            message: 'Access Group Deleted',
            color: 'positive',
            position: 'bottom',
            timeout: 2000,
        });
    },
    onError: () => {
        Notify.create({
            message: 'Error deleting Access Group',
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
    },
});

function onClick(): void {
    if (!canModify.value || isPrimary.value) return;
    _deleteAccessGroup();
}
</script>
