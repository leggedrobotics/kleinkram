<template>
  <InspectRun :run_uuid="route.query.uuid" />
</template>

<script setup lang="ts">

import InspectRun from 'components/InspectRun.vue';
import { useRoute } from 'vue-router';

const route = useRoute()
</script>

<style scoped>

</style>
