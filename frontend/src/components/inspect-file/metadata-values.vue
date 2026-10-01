<template>
    <div v-if="Object.keys(values).length > 0" class="metadata__values">
        <template v-for="(value, key) in values" :key="key">
            <div class="text-grey-7">{{ key }}</div>
            <div class="metadata__value">{{ value }}</div>
        </template>
    </div>
    <div v-else class="text-caption text-grey-7">No values</div>
</template>

<script setup lang="ts">
defineProps<{ values: Record<string, string> }>();
</script>

<style scoped>
.metadata__values {
    display: grid;
    grid-template-columns: minmax(120px, max-content) 1fr;
    column-gap: 24px;
    row-gap: 2px;
    font-size: 13.5px;
}

.metadata__value {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
}

@media (max-width: 599px) {
    .metadata__values {
        grid-template-columns: 1fr;
    }
}
</style>
