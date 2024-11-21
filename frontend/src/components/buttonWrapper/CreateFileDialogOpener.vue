<template>
    <div @click="createNewTageType">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import CreateFileDialog from 'src/dialogs/CreateFileDialog.vue';
import { inject, Ref } from 'vue';

const $q = useQuasar();
const props = defineProps<{
    mission?: Mission;
}>();
const uploads = inject('uploads')!;
const createNewTageType = () =>
    $q.dialog({
        title: 'Create new mission',
        component: CreateFileDialog,
        componentProps: {
            mission: props.mission,
            uploads,
        },
    });
</script>
