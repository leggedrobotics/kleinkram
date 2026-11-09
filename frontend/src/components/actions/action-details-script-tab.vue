<template>
    <div :class="$q.screen.xs ? 'q-py-md' : 'q-pa-md'">
        <p class="help-text q-mb-lg" style="max-width: 650px">
            This action ran a single Python file submitted with
            <code>klein action run-script</code>, rather than a Docker image.
            The exact source is stored alongside the execution, so the artifacts
            above can always be traced back to the code that produced them.
        </p>

        <div v-if="isLoading" class="flex flex-center q-pa-lg">
            <q-spinner color="primary" size="2em" />
        </div>

        <div v-else-if="error" class="text-negative q-pa-md">
            <q-icon name="sym_o_error" size="sm" class="q-mr-sm" />
            Could not load the script: {{ error.message }}
        </div>

        <div v-else-if="script" class="script-viewer">
            <div class="script-viewer__header">
                <div class="script-viewer__name">
                    <q-icon
                        name="sym_o_description"
                        size="18px"
                        class="q-mr-sm text-icon-secondary"
                    />
                    <span>{{ script.filename }}</span>
                </div>
                <div class="script-viewer__meta">
                    <span>{{ lineCount }} lines</span>
                    <q-btn
                        flat
                        dense
                        size="sm"
                        icon="sym_o_content_copy"
                        label="Copy"
                        @click="copyScript"
                    >
                        <q-tooltip>Copy the script to the clipboard</q-tooltip>
                    </q-btn>
                </div>
            </div>

            <div class="script-viewer__body">
                <pre class="script-viewer__gutter">{{ gutter }}</pre>
                <!-- eslint-disable-next-line vue/no-v-html -->
                <pre class="script-viewer__code" v-html="highlighted"></pre>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { useQuasar } from 'quasar';
import { ActionService } from 'src/api/services/action.service';
import { highlightPython } from 'src/services/highlight-python';
import { computed } from 'vue';

const properties = defineProps<{ actionUuid: string }>();

const $q = useQuasar();

const {
    data: script,
    isLoading,
    error,
} = useQuery({
    queryKey: ['action', 'script', properties.actionUuid],
    queryFn: () => ActionService.getScript(properties.actionUuid),
    staleTime: Infinity, // a stored script never changes
});

const lineCount = computed(() => script.value?.content.split('\n').length ?? 0);

const gutter = computed(() =>
    Array.from({ length: lineCount.value }, (_, index) => index + 1).join('\n'),
);

const highlighted = computed(() =>
    script.value ? highlightPython(script.value.content) : '',
);

const copyScript = async (): Promise<void> => {
    if (!script.value) return;
    await navigator.clipboard.writeText(script.value.content);
    $q.notify({ message: 'Script copied', color: 'positive', icon: 'check' });
};
</script>

<style scoped lang="scss">
.script-viewer {
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
    background: #fbfbfb;
}

.script-viewer__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid #e0e0e0;
    background: #f4f4f4;
}

.script-viewer__name {
    display: flex;
    align-items: center;
    font-family: monospace;
    font-size: 0.85rem;
}

.script-viewer__meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 0.75rem;
    color: #666;
}

.script-viewer__body {
    display: flex;
    overflow: auto;
    max-height: 70vh;
}

.script-viewer__gutter,
.script-viewer__code {
    margin: 0;
    padding: 12px 0;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.8rem;
    line-height: 1.5;
}

.script-viewer__gutter {
    padding-left: 12px;
    padding-right: 12px;
    text-align: right;
    color: #b0b0b0;
    background: #f4f4f4;
    user-select: none;
    flex: none;
}

.script-viewer__code {
    padding-right: 16px;
    padding-left: 16px;
    flex: 1;
    white-space: pre;
}

// Token colours, kept close to the muted palette used elsewhere.
.script-viewer__code :deep(.tok-comment) {
    color: #8a8a8a;
    font-style: italic;
}
.script-viewer__code :deep(.tok-string) {
    color: #0a7c4a;
}
.script-viewer__code :deep(.tok-keyword) {
    color: #0b5fa5;
    font-weight: 600;
}
.script-viewer__code :deep(.tok-builtin) {
    color: #7b4fb5;
}
.script-viewer__code :deep(.tok-number) {
    color: #b35c00;
}
.script-viewer__code :deep(.tok-decorator) {
    color: #b35c00;
}
.script-viewer__code :deep(.tok-def) {
    color: #a1237a;
    font-weight: 600;
}
</style>
