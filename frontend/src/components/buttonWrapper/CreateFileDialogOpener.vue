<template>
    <div @click="createNewTageType">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import CreateFileDialog from 'src/dialogs/CreateFileDialog.vue';

const $q = useQuasar();

const createNewTageType = () =>
    $q.dialog({
        title: 'Create new mission',
        component: CreateFileDialog,
    });
</script>
