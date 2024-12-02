<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
        @click="clicked"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to modify this project
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import {
    canModifyProject,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';
import ModifyProjectTagsDialog from 'src/dialogs/ModifyProjectTagsDialog.vue';

const $q = useQuasar();
const props = defineProps<{
    project_uuid: string;
}>();

const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canModifyProject(props.project_uuid, permissions.value),
);

const clicked = (): void => {
    // abort if the user cannot modify the project
    if (!canModify.value) return;
    console.log(props.project_uuid);
    // open the dialog
    $q.dialog({
        component: ModifyProjectTagsDialog,
        componentProps: {
            projectUUID: props.project_uuid,
        },
    });
};
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>
