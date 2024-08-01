<template>
  <InspectFile :uuid="route.query.uuid" />
</template>

<script setup lang="ts">
import InspectFile from 'components/InspectFile.vue';
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<style scoped></style>
