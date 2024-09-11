<template>
    <div v-for="[path, spec] in Object.entries(filteredSpec.paths)">
        <Endpoint :endpoint="path" :spec="spec" />
    </div>
</template>

<script setup lang="ts">
import fullspec from '../../swagger-spec.json';
import Endpoint from './Endpoint.vue';

const props = defineProps<{
    module: string;
}>();

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

const filteredSpec = filterSpecByPath(fullspec, '/' + props.module);
</script>
