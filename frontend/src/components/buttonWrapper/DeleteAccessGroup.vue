<template>
    <div
        @click="_deleteAccessGroup"
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
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

const { mutate: _deleteAccessGroup } = useMutation({
    mutationFn: () => deleteAccessGroup(props.accessGroup.uuid),
    onSuccess: () => {
        queryClient.invalidateQueries({
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
    onError: (error) => {
        Notify.create({
            message: 'Error deleting Access Group',
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
    },
});
</script>

<style scoped></style>
