<template>
    <div
        :class="
            {
                disabled: !canModify,
                'cursor-pointer': !canModify,
                'cursor-not-allowed': canModify,
            } as any
        "
        @click="
            // eslint-disable-next-line vue/v-on-handler-style
            () => {
                // @ts-ignore
                _deleteAccessGroup();
            }
        "
    >
        <slot />
        <q-tooltip v-if="accessGroup.type === AccessGroupType.PRIMARY">
            You can't delete the primary access group
        </q-tooltip>
        <q-tooltip v-else-if="!canModify">
            Only the creator can delete this access group. You are not the
            creator.
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { AccessGroupDto, CurrentAPIUserDto } from '@api/types/user.dto';
import { AccessGroupType, UserRole } from '@common/enum';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { getUser } from 'src/services/auth';
import { deleteAccessGroup } from 'src/services/mutations/access';
import { computed, Ref, ref } from 'vue';

const { accessGroup } = defineProps<{ accessGroup: AccessGroupDto }>();

const me: Ref<CurrentAPIUserDto | undefined> = ref(undefined);
await getUser().then((user) => {
    me.value = user ?? undefined;
});

const canModify = computed(() => {
    if (me.value === undefined) return false;
    if (me.value.role === UserRole.ADMIN) {
        return true;
    }
    return accessGroup.creator?.uuid === me.value.uuid;
});
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
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>

<style scoped></style>
