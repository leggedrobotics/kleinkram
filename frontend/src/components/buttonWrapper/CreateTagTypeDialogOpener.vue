<template>
    <div
        @click="createNewTageType"
        :class="{
            disabled: !canCreate,
            'cursor-pointer': !canCreate,
            'cursor-not-allowed': canCreate,
        }"
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import CreateTagType from 'src/dialogs/CreateTagTypeDialog.vue';
import {
    canCreateProject,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';

const $q = useQuasar();
const { data: permissions } = usePermissionsQuery();
const canCreate = computed(() => canCreateProject(permissions.value));

const createNewTageType = () => {
    if (!canCreate.value) return;
    $q.dialog({
        title: 'Create new mission',
        component: CreateTagType,
    });
};
</script>
