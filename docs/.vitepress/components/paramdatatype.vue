<!-- eslint-disable vue/multi-word-component-names -->
// eslint-disable-next-line vue/multi-word-component-names
// eslint-disable-next-line unicorn/filename-case
// eslint-disable-next-line vue/multi-word-component-names
// eslint-disable-next-line unicorn/filename-case
<template>
    <div>
        <Hint :hint="required ? 'Required':undefined">
            {{ props.datatype || 'N/A' }}
        </Hint>
    </div>
</template>
<script setup lang="ts">
import Hint from './hint.vue';

const props = defineProps<{
    datatype: string;
    required: boolean;
}>();
</script>
<style scoped>

</style>
