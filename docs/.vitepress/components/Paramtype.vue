
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
.body-param {
    background-color: #e5c1f3;
    color: #5f2361;
}

.path-param {
    background-color: #c6f3c1;
    color: #276123;
}
.base {
    padding: 4px;
    border-radius: 4px;
}
</style>