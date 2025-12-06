<!-- eslint-disable vue/multi-word-component-names -->
// eslint-disable-next-line vue/multi-word-component-names
// eslint-disable-next-line unicorn/filename-case
// eslint-disable-next-line vue/multi-word-component-names
// eslint-disable-next-line unicorn/filename-case
<template>
    <div v-if="filteredSpec" style="margin-top: 25px">
        // eslint-disable-next-line vue/require-v-for-key
        <!-- eslint-disable-next-line vue/require-v-for-key -->
        <div v-for="[path, spec] in Object.entries(filteredSpec.paths)">
            <Endpoint :endpoint="path" :spec="spec" :schema="schema" />
        </div>
    </div>
    <div v-else>Loading Swagger spec...</div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import Endpoint from './endpoint.vue';

const props = defineProps<{
    module: string;
}>();
/* eslint-disable @typescript-eslint/no-explicit-any */
const swaggerSpec = ref<any>(null);

const filteredSpec = ref<any>(null);
const schema = ref<any>(null);
/* eslint-enable @typescript-eslint/no-explicit-any */

// Function to filter the OpenAPI spec by path prefix
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterSpecByPath(spec: any, pathPrefix: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const filteredSpec = { ...spec };


    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    filteredSpec.paths = Object.keys(spec.paths)
        .filter((path) => path.startsWith(pathPrefix))
        // eslint-disable-next-line unicorn/no-array-reduce
        .reduce((object, key) => {

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            object[key] = spec.paths[key];
            return object;
        }, {});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return filteredSpec;
}

watch(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    () => swaggerSpec.value,
    (newValue) => {

        if (newValue) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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


            // @ts-ignore
            const baseUrl = (import.meta.env.BACKEND_URL as string | undefined) ?? 'http://localhost:3000';
            const endpoint = `${baseUrl}/swagger/json`;

            // eslint-disable-next-line no-console
            console.log('Fetching swagger spec from:', endpoint);

            const response = await fetch(endpoint);
            if (!response.ok) {
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const spec = await response.json();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            swaggerSpec.value = spec;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        filteredSpec.value = filterSpecByPath(
            swaggerSpec.value,
            '/' + props.module,
        );
        // eslint-disable-next-line no-console
        console.log(swaggerSpec.value);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        schema.value = swaggerSpec.value.components.schemas;
    } catch (error) {
        console.error('Error loading swagger-spec.json:', error);
    }
});
</script>
