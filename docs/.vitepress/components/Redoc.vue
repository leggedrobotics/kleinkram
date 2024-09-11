<template>
    <div id="redoc-container"></div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

// Redoc initialization logic
onMounted(() => {
    const script = document.createElement('script');
    script.src =
        'https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js';
    document.head.appendChild(script);

    script.onload = () => {
        // Once the script is loaded, initialize Redoc
        if (window.Redoc) {
            window.Redoc.init(
                '/swagger-spec.json',
                {},
                document.getElementById('redoc-container'),
            );
        }
    };
});
</script>
