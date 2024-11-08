<template>
    <div>
        <Hint :hint="required ? 'Required':undefined">
            {{ props.datatype || 'N/A' }}
        </Hint>
    </div>
</template>
<script setup lang="ts">
import Hint from './Hint.vue';

const props = defineProps<{
    datatype: string;
    required: boolean;
}>();
</script>
<style scoped>

</style>