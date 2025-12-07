<!-- eslint-disable vue/multi-word-component-names -->

// eslint-disable-next-line vue/multi-word-component-names

// eslint-disable-next-line unicorn/filename-case

// eslint-disable-next-line vue/multi-word-component-names

// eslint-disable-next-line unicorn/filename-case

<template>
    <div :class="`${props.paramtype}-param base`" >
        {{ props.paramtype }}
    </div>
</template>
<script setup lang="ts">
const props = defineProps<{
    paramtype: string;
}>();
</script>
<style scoped>
.query-param {
    background-color: #c3d8fd;
    color: #1c275a;
}
.dark .query-param {
    background-color: #1c275a;
    color: #c3d8fd;
    border: 1px solid #c3d8fd;
}

.body-param {
    background-color: #e5c1f3;
    color: #5f2361;
}
.dark .body-param {
    background-color: #5f2361;
    color: #e5c1f3;
    border: 1px solid #e5c1f3;
}

.path-param {
    background-color: #c6f3c1;
    color: #276123;
}
.dark .path-param {
    background-color: #276123;
    color: #c6f3c1;
    border: 1px solid #c6f3c1;
}

.base {
    padding: 4px;
    border-radius: 4px;
}
</style>
