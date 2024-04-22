<template>
  <q-card>
    <create-project/>
    <q-separator/>
    <create-run/>
    <q-separator/>
    <create-file/>
  </q-card>
  <q-card>
    <QueueItems/>
  </q-card>
</template>
<script setup lang="ts">
import CreateProject from 'components/CreateProject.vue';
import CreateRun from 'components/CreateRun.vue';
import CreateFile from 'components/CreateFile.vue';
import QueueItems from 'components/QueueItems.vue';

</script>

<style scoped>

</style>
