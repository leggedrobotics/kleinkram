<template>
    <div
        :class="{
            disabled: !canCreate,
            'cursor-pointer': !canCreate,
            'cursor-not-allowed': canCreate,
        }"
        @click="createNewTageType"
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { canCreateProject, usePermissionsQuery } from '@hooks/query-hooks';
import { computed } from 'vue';
import CreateTagTypeDialog from '../../dialogs/create-tag-type-dialog.vue';

const $q = useQuasar();
const { data: permissions } = usePermissionsQuery();
const canCreate = computed(() => canCreateProject(permissions.value));

const createNewTageType = (): void => {
    if (!canCreate.value) return;
    $q.dialog({
        title: 'Create new mission',
        component: CreateTagTypeDialog,
    });
};
</script>
