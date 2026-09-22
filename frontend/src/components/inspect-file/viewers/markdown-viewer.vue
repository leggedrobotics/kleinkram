<template>
    <div class="bg-white rounded-borders border-solid q-pa-md">
        <div class="row justify-end q-mb-sm">
            <q-btn-toggle
                v-model="mode"
                dense
                flat
                no-caps
                toggle-color="primary"
                size="sm"
                :options="[
                    { label: 'Rendered', value: 'rendered' },
                    { label: 'Source', value: 'source' },
                ]"
            />
            <q-btn
                icon="sym_o_content_copy"
                flat
                round
                dense
                size="sm"
                color="grey-7"
                class="q-ml-sm"
                @click="copyRaw"
            >
                <q-tooltip>Copy Content</q-tooltip>
            </q-btn>
        </div>

        <q-banner
            v-if="truncated"
            dense
            class="bg-orange-1 text-orange-9 q-mb-md rounded-borders"
        >
            <template #avatar>
                <q-icon name="sym_o_info" />
            </template>
            Only the beginning of this file is previewed. Download it to read
            the rest.
        </q-banner>

        <!-- Markdown is rendered with raw HTML disabled and sanitized by DOMPurify. -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
            v-if="mode === 'rendered'"
            class="markdown-body"
            v-html="renderedHtml"
        ></div>
        <div v-else class="code-block bg-grey-1 q-pa-md rounded-borders">
            <pre class="q-ma-none text-code">{{ content }}</pre>
        </div>
    </div>
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { Notify, copyToClipboard } from 'quasar';
import { computed, ref } from 'vue';

const properties = withDefaults(
    defineProps<{
        content: string;
        /** Set when `content` is only the leading slice of a larger file. */
        truncated?: boolean;
    }>(),
    { truncated: false },
);

const mode = ref<'rendered' | 'source'>('rendered');

// `html: false` drops raw HTML blocks in the source, so untrusted markup never
// reaches the renderer; DOMPurify is the second line of defence.
const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
});

const renderedHtml = computed(() =>
    DOMPurify.sanitize(markdown.render(properties.content), {
        ADD_ATTR: ['target', 'rel'],
    }),
);

async function copyRaw(): Promise<void> {
    await copyToClipboard(properties.content);
    Notify.create({ message: 'Content copied', color: 'positive' });
}
</script>

<style scoped>
.border-solid {
    border: 1px solid #e0e0e0;
}
.text-code {
    font-family: monospace;
    font-size: 13px;
}
.code-block {
    max-width: 100%;
    min-width: 0;
    overflow-x: auto;
}

/* Markdown output is generated, so it cannot carry Quasar classes. */
.markdown-body {
    max-width: 100%;
    overflow-x: auto;
    line-height: 1.6;
    word-break: break-word;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
    margin: 24px 0 12px;
    line-height: 1.3;
    font-weight: 600;
}
.markdown-body :deep(h1) {
    font-size: 1.8em;
}
.markdown-body :deep(h2) {
    font-size: 1.45em;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 4px;
}
.markdown-body :deep(h3) {
    font-size: 1.2em;
}
.markdown-body :deep(:first-child) {
    margin-top: 0;
}
.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(blockquote) {
    margin: 0 0 12px;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
    padding-left: 24px;
}
.markdown-body :deep(li) {
    margin-bottom: 4px;
}
.markdown-body :deep(code) {
    font-family: monospace;
    font-size: 0.9em;
    background: #f5f5f5;
    border-radius: 3px;
    padding: 1px 4px;
}
.markdown-body :deep(pre) {
    background: #f5f5f5;
    border-radius: 4px;
    padding: 12px;
    overflow-x: auto;
}
.markdown-body :deep(pre code) {
    background: none;
    padding: 0;
}
.markdown-body :deep(blockquote) {
    border-left: 3px solid #e0e0e0;
    padding-left: 12px;
    color: #616161;
}
.markdown-body :deep(table) {
    border-collapse: collapse;
    margin-bottom: 12px;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
    border: 1px solid #e0e0e0;
    padding: 6px 10px;
    text-align: left;
}
.markdown-body :deep(th) {
    background: #fafafa;
}
.markdown-body :deep(img) {
    max-width: 100%;
}
.markdown-body :deep(hr) {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 20px 0;
}
</style>
