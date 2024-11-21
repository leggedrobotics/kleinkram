<template>
    <div
        :class="
            {
                disabled: !canModify,
                'cursor-pointer': !canModify,
                'cursor-not-allowed': canModify,
            } as any
        "
        @click="_deleteAccessGroup"
    >
        <slot />
        <q-tooltip v-if="props.accessGroup.personal">
            You can't delete personal access groups
        </q-tooltip>
        <q-tooltip v-else-if="!canModify">
            Only the creator can delete this access group. You are not the
            creator.
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { Notify } from 'quasar';
import { computed, Ref, ref } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { deleteAccessGroup } from 'src/services/mutations/access';
import { getUser } from 'src/services/auth';
import { UserRole } from '@common/enum';

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
const queryClient = useQueryClient();

const { mutate: _deleteAccessGroup } = useMutation({
    mutationFn: () => deleteAccessGroup(props.accessGroup.uuid),
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
