<template>
    <div @click="createNewTageType">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import CreateTagType from 'src/dialogs/CreateTagTypeDialog.vue';

const $q = useQuasar();

const createNewTageType = () =>
    $q.dialog({
        title: 'Create new mission',
        component: CreateTagType,
    });
</script>
