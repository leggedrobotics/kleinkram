<template>
    <q-btn
        :href="documentationLink"
        round
        flat
        color="grey-8"
        target="_blank"
        icon="sym_o_help"
    >
        <q-tooltip> Support</q-tooltip>
    </q-btn>
</template>
<script setup lang="ts">
const { link } = defineProps<{ link?: string }>();

const documentationBasePath = 'https://docs.datasets.leggedrobotics.com';
const documentationDefaultPath = '/usage/getting-started.html';

const documentationLink =
    link || documentationBasePath + documentationDefaultPath;
</script>
