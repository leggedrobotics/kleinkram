<template>
    <div v-if="filteredSpec">
        <div v-for="[path, spec] in Object.entries(filteredSpec.paths)">
            <Endpoint :endpoint="path" :spec="spec" />
        </div>
    </div>
    <div v-else>Loading Swagger spec...</div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import Endpoint from './Endpoint.vue';

const props = defineProps<{
    module: string;
}>();
const swaggerSpec = ref(null);

// import('../../docs/swagger-spec.json').then((spec) => {
//     swaggerSpec.value = spec;
// });

const filteredSpec = ref(null);

// Function to filter the OpenAPI spec by path prefix
function filterSpecByPath(spec: any, pathPrefix: string) {
    const filteredSpec = { ...spec };
    filteredSpec.paths = Object.keys(spec.paths)
        .filter((path) => path.startsWith(pathPrefix))
        .reduce((obj, key) => {
            obj[key] = spec.paths[key];
            return obj;
        }, {});
    return filteredSpec;
}
watch(
    () => swaggerSpec.value,
    (newVal) => {
        if (newVal) {
            filteredSpec.value = filterSpecByPath(
                swaggerSpec.value,
                '/' + props.module,
            );
        }
    },
);

// Fetch the swagger-spec.json at runtime
onMounted(async () => {
    try {
        if (!swaggerSpec.value) {
            const response = await fetch('/swagger/swagger-spec.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const spec = await response.json();
            swaggerSpec.value = spec;
        }

        filteredSpec.value = filterSpecByPath(
            swaggerSpec.value,
            '/' + props.module,
        );
    } catch (error) {
        console.error('Error loading swagger-spec.json:', error);
    }
});
</script>
