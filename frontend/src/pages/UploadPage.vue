<template>
    <q-card>
        <create-tag-type />
        <create-project />
        <q-separator />
        <create-mission />
        <q-separator />
        <create-file />
    </q-card>
    <q-card>
        <QueueItems />
    </q-card>
</template>
<script setup lang="ts">
import CreateProject from 'components/CreateProject.vue';
import CreateMission from 'components/CreateMission.vue';
import CreateFile from 'components/CreateFile.vue';
import QueueItems from 'components/QueueItems.vue';
import CreateTagType from 'components/CreateTagType.vue';
</script>

<style scoped></style>
