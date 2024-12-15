<template>
    <router-view />
</template>
<script setup lang="ts">
import { provide, Ref, ref } from 'vue';
import { FileUploadDto } from '@api/types/upload.dto';

const uploads: Ref<Ref<FileUploadDto>[]> = ref([]);
// Provide the globalState object
provide('uploads', uploads);
</script>
