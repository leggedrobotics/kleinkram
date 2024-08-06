<template>
    <InspectFile
        :uuid="route.query.uuid"
        v-if="route.query.uuid && typeof route.query.uuid === 'string'"
    />
</template>

<script setup lang="ts">
import InspectFile from 'components/InspectFile.vue';
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<style scoped></style>
