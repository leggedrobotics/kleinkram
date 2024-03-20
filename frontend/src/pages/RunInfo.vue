<template>
  <InspectRun :run_uuid="route.query.uuid" />
</template>

<script setup lang="ts">

import InspectRun from 'components/InspectRun.vue';
import { useRoute } from 'vue-router';

const route = useRoute()
console.log(route.params.uuid)
</script>

<style scoped>

</style>
