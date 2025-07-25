<template>
    <q-btn
        flat
        class="bg-button-secondary text-on-color"
        label="Create Access Group"
        icon="sym_o_add"
        :disable="!canCreate"
        @click="createAccessGroupDialog"
    >
        <q-tooltip v-if="!canCreate">
            You do not have permission to create a new Access Group
        </q-tooltip>
    </q-btn>
</template>

<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, useQuasar } from 'quasar';
import CreateAccessGroupDialog from 'src/dialogs/create-access-group-dialog.vue';
import { canCreateProject, usePermissionsQuery } from 'src/hooks/query-hooks';
import { createAccessGroup } from 'src/services/mutations/access';
import { computed, unref } from 'vue';

const { data: permissions } = usePermissionsQuery();
const canCreate = computed(() => canCreateProject(permissions.value));
const queryClient = useQueryClient();

const $q = useQuasar();
const { mutate: _createAccessGroup } = useMutation({
    mutationFn: (name: string) => createAccessGroup(unref(name)),
    onSuccess: async () => {
        await queryClient.invalidateQueries({
            predicate: (query) => {
                return query.queryKey[0] === 'accessGroups';
            },
        });
        Notify.create({
            message: 'Access Group Created',
            color: 'positive',
            position: 'bottom',
            timeout: 2000,
        });
    },
    onError: () => {
        Notify.create({
            message: 'Error creating Access Group',
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
    },
});

const createAccessGroupDialog = (): void => {
    $q.dialog({
        component: CreateAccessGroupDialog,
    }).onOk((name: string) => {
        _createAccessGroup(name);
    });
};
</script>
