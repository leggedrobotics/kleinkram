<template>
    <div v-if="Object.keys(values).length > 0" class="metadata__values">
        <template v-for="(value, key) in values" :key="key">
            <div class="text-grey-7">{{ key }}</div>
            <!-- eslint-disable vue/no-v-html -- the highlighter escapes its input -->
            <pre
                v-if="looksLikeYaml(value)"
                class="metadata__yaml"
                v-html="highlightYaml(value)"
            ></pre>
            <!-- eslint-enable vue/no-v-html -->
            <div v-else class="metadata__value">{{ value }}</div>
        </template>
    </div>
    <div v-else class="text-caption text-grey-7">No values</div>
</template>

<script setup lang="ts">
import { highlightYaml, looksLikeYaml } from 'src/services/highlight-yaml';

defineProps<{ values: Record<string, string> }>();
</script>

<style scoped>
.metadata__values {
    display: grid;
    grid-template-columns: minmax(120px, max-content) minmax(0, 1fr);
    column-gap: 24px;
    row-gap: 2px;
    font-size: 13.5px;
}

.metadata__value {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
}

/* A value that is itself a document, such as rosbag2's serialized_metadata */
.metadata__yaml {
    margin: 0;
    padding: 10px 14px;
    max-height: 520px;
    overflow: auto;
    font-family: monospace;
    font-size: 13px;
    line-height: 1.5;
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
}

/* Same muted palette as the action script viewer. */
.metadata__yaml :deep(.tok-key) {
    color: #0b5fa5;
}
.metadata__yaml :deep(.tok-punctuation) {
    color: #8a8a8a;
}
.metadata__yaml :deep(.tok-number) {
    color: #b35c00;
}
.metadata__yaml :deep(.tok-builtin) {
    color: #7b4fb5;
}
.metadata__yaml :deep(.tok-string) {
    color: #0a7c4a;
}
.metadata__yaml :deep(.tok-comment) {
    color: #8a8a8a;
    font-style: italic;
}

@media (max-width: 599px) {
    .metadata__values {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
