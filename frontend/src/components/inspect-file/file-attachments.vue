<template>
    <div>
        <h2 class="text-h5 text-md-h4 q-mt-none q-mb-md">Attachments</h2>
        <q-list bordered separator class="rounded-borders bg-white">
            <q-item
                v-for="(attachment, index) in attachments"
                :key="`${attachment.name}:${String(attachment.logTime)}`"
                class="column"
            >
                <div class="row items-center no-wrap full-width">
                    <q-item-section avatar>
                        <q-icon name="sym_o_description" />
                    </q-item-section>
                    <q-item-section>
                        <q-item-label class="attachment__name">
                            {{ attachment.name }}
                        </q-item-label>
                        <q-item-label caption>
                            {{ attachment.mediaType || 'unknown type' }} ·
                            {{ formatSize(attachment.size) }}
                        </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                        <div class="row no-wrap q-gutter-x-xs">
                            <q-btn
                                v-if="isText(attachment)"
                                flat
                                round
                                dense
                                color="primary"
                                :icon="
                                    shown[index] === undefined
                                        ? 'sym_o_visibility'
                                        : 'sym_o_visibility_off'
                                "
                                :loading="busy[index] === 'view'"
                                :aria-label="`Show ${attachment.name}`"
                                @click="() => toggle(index)"
                            >
                                <q-tooltip>
                                    {{
                                        shown[index] === undefined
                                            ? 'Show content'
                                            : 'Hide content'
                                    }}
                                </q-tooltip>
                            </q-btn>
                            <q-btn
                                flat
                                round
                                dense
                                color="primary"
                                icon="sym_o_download"
                                :loading="busy[index] === 'download'"
                                :aria-label="`Download ${attachment.name}`"
                                @click="() => download(index)"
                            >
                                <q-tooltip>Download attachment</q-tooltip>
                            </q-btn>
                        </div>
                    </q-item-section>
                </div>
                <!-- eslint-disable vue/no-v-html -- the highlighter escapes its input -->
                <pre
                    v-if="shown[index] !== undefined && isYaml(attachment)"
                    class="attachment__content bg-grey-1 q-pa-md q-mt-sm q-mb-none rounded-borders"
                    v-html="highlightYaml(shown[index] ?? '')"
                ></pre>
                <!-- eslint-enable vue/no-v-html -->
                <pre
                    v-else-if="shown[index] !== undefined"
                    class="attachment__content bg-grey-1 q-pa-md q-mt-sm q-mb-none rounded-borders"
                    >{{ shown[index] }}</pre>
            </q-item>
        </q-list>
    </div>
</template>

<script setup lang="ts">
import { Notify } from 'quasar';
import type { RecordingAttachment } from 'src/services/decoding-strategies/recording-insights';
import { formatSize } from 'src/services/general-formatting';
import { highlightYaml } from 'src/services/highlight-yaml';
import { reactive } from 'vue';

const properties = defineProps<{
    attachments: RecordingAttachment[];
    read: (index: number) => Promise<Uint8Array | undefined>;
}>();

/** Attachments shown inline are decoded as text up to this size. */
const MAX_INLINE_BYTES = 512 * 1024;
const TEXT_TYPES = /^text\/|json|yaml|xml|urdf|toml/i;
const TEXT_NAMES = /\.(ya?ml|json|txt|xml|urdf|xacro|toml|md|csv)$/i;

const isYaml = (attachment: RecordingAttachment): boolean =>
    /yaml/i.test(attachment.mediaType) || /\.ya?ml$/i.test(attachment.name);

const shown = reactive<Record<number, string | undefined>>({});
const busy = reactive<Record<number, 'view' | 'download' | undefined>>({});

const isText = (attachment: RecordingAttachment): boolean =>
    attachment.size <= MAX_INLINE_BYTES &&
    (TEXT_TYPES.test(attachment.mediaType) || TEXT_NAMES.test(attachment.name));

async function load(
    index: number,
    purpose: 'view' | 'download',
): Promise<Uint8Array | undefined> {
    busy[index] = purpose;
    try {
        const data = await properties.read(index);
        if (!data) throw new Error('attachment not found in the file');
        return data;
    } catch (error: unknown) {
        Notify.create({
            message: `Failed to read attachment: ${
                error instanceof Error ? error.message : String(error)
            }`,
            color: 'negative',
            icon: 'sym_o_warning',
        });
        return undefined;
    } finally {
        busy[index] = undefined;
    }
}

async function toggle(index: number): Promise<void> {
    if (shown[index] !== undefined) {
        shown[index] = undefined;
        return;
    }
    const data = await load(index, 'view');
    if (data) shown[index] = new TextDecoder().decode(data);
}

async function download(index: number): Promise<void> {
    const attachment = properties.attachments[index];
    const data = await load(index, 'download');
    if (!attachment || !data) return;

    const url = URL.createObjectURL(
        new Blob([new Uint8Array(data)], {
            type: attachment.mediaType || 'application/octet-stream',
        }),
    );
    const link = document.createElement('a');
    link.href = url;
    // Attachment names are often paths; the browser wants a bare file name.
    link.download = attachment.name.split('/').pop() ?? attachment.name;
    link.click();
    URL.revokeObjectURL(url);
}
</script>

<style scoped>
.attachment__name {
    overflow-wrap: anywhere;
}

/* Same muted palette as the action script viewer. */
.attachment__content :deep(.tok-key) {
    color: #0b5fa5;
}
.attachment__content :deep(.tok-punctuation) {
    color: #8a8a8a;
}
.attachment__content :deep(.tok-number) {
    color: #b35c00;
}
.attachment__content :deep(.tok-builtin) {
    color: #7b4fb5;
}
.attachment__content :deep(.tok-string) {
    color: #0a7c4a;
}
.attachment__content :deep(.tok-comment) {
    color: #8a8a8a;
    font-style: italic;
}

.attachment__content {
    width: 100%;
    max-height: 420px;
    overflow: auto;
    font-family: monospace;
    font-size: 13px;
    border: 1px solid #e0e0e0;
}
</style>
