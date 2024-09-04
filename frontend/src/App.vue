<template>
    <router-view />
</template>
<script setup lang="ts">
import { ref, provide } from 'vue';
import { FileUpload } from 'src/types/FileUpload';

const uploads: ref<ref<FileUpload>[]> = ref([]);
// Provide the globalState object
provide('uploads', uploads);
</script>
