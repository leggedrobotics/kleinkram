<template>
    <div class="cursor-pointer" @click="open">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import RestoreProjectDialog from 'src/dialogs/restore-project-dialog.vue';

const { projectUuid } = defineProps<{ projectUuid: string }>();
const $q = useQuasar();

const open = (): void => {
    $q.dialog({
        component: RestoreProjectDialog,
        componentProps: { projectUuid },
    });
};
</script>
