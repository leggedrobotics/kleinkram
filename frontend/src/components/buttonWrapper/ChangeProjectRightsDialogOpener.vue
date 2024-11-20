<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
        @click="changeRights"
    >
        <slot />

        <q-tooltip v-if="!canModify">
            You need delete rights on the project to remove it from this access
            group
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed } from 'vue';
import {
    canDeleteProject,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import ChangeAccessRightsDialog from 'src/dialogs/ChangeAccessRightsDialog.vue';

const $q = useQuasar();
const props = defineProps<{
    projectAccessUUID: string;
    projectUUID: string;
}>();

const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canDeleteProject(props.projectUUID, permissions.value),
);

function changeRights() {
    if (!canModify.value) {
        return;
    }
    $q.dialog({
        component: ChangeAccessRightsDialog,
        componentProps: {
            project_uuid: props.projectUUID,
            project_access_uuid: props.projectAccessUUID,
        },
    });
}
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>

<style scoped></style>
