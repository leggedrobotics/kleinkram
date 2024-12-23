<template>
    <div v-if="filteredSpec" style="margin-top: 25px">
        <div v-for="[path, spec] in Object.entries(filteredSpec.paths)">
            <Endpoint :endpoint="path" :spec="spec" :schema="schema" />
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

const filteredSpec = ref(null);
const schema = ref(null);

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
            let endpoint = 'http://localhost:3000/swagger/json';

            const mode = import.meta.env.VITE_MODE;
            if (mode === 'production') {
                endpoint =
                    'https://api.datasets.leggedrobotics.com/swagger/json';
            } else if (mode === 'staging') {
                endpoint =
                    'https://api.datasets.dev.leggedrobotics.com/swagger/json';
            }
            console.log('Fetching swagger spec from:', endpoint);

            const response = await fetch(endpoint);
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
        console.log(swaggerSpec.value);
        schema.value = swaggerSpec.value.components.schemas;
    } catch (error) {
        console.error('Error loading swagger-spec.json:', error);
    }
});
</script>
