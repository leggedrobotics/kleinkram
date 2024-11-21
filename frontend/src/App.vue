<template>
    <router-view />
</template>
<script setup lang="ts">
import { provide, ref } from 'vue';

const uploads: Ref<Ref<FileUpload>[]> = ref([]);
// Provide the globalState object
provide('uploads', uploads);
</script>
