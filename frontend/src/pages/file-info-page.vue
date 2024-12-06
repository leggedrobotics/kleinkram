<template>
    <InspectFile v-if="!!file_uuid" :uuid="file_uuid" />
</template>

<script setup lang="ts">
import { useFileUUID } from '../hooks/router-hooks';
import InspectFile from '@components/inspect-file.vue';

const file_uuid = useFileUUID();
</script>

<style scoped></style>
