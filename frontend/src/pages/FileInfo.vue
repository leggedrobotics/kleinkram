<template>
    <InspectFile v-if="!!file_uuid" :uuid="file_uuid" />
</template>

<script setup lang="ts">
import InspectFile from 'components/InspectFile.vue';

import { useFileUUID } from '../hooks/router-hooks';

const file_uuid = useFileUUID();
</script>

<style scoped></style>
