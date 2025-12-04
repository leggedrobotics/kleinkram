<template>
    <router-view />
</template>
<script setup lang="ts">
import type { FileUploadDto } from '@kleinkram/api-dto/types/upload.dto';
import { provide, Ref, ref } from 'vue';

const uploads: Ref<Ref<FileUploadDto>[]> = ref([]);
// Provide the globalState object
provide('uploads', uploads);
</script>
