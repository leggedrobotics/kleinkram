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

<style scoped>
.fullscreen-loader {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: #f5f5f5;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    font-family: sans-serif;
}

.spinner {
    width: 50px;
    height: 50px;
    border: 5px solid #ddd;
    border-top-color: #1976d2;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
}

.message {
    font-size: 1.2rem;
    color: #333;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
