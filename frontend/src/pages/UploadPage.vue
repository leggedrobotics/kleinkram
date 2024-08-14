<template>
    <q-card>
        <create-file />
    </q-card>
    <q-card>
        <QueueItems />
    </q-card>
</template>
<script setup lang="ts">
import CreateFile from 'components/CreateFile.vue';
import QueueItems from 'components/QueueItems.vue';
</script>

<style scoped></style>
