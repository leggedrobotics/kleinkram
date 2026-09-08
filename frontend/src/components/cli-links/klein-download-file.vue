<template>
    <div style="width: 100%">
        <p
            style="
                font-size: medium;
                margin-bottom: 0;
                padding-bottom: 0;
                margin-top: 8px;
            "
            class="q-pa-sm"
        >
            Kleinkram CLI:
        </p>
        <div class="button-border klein-command__box">
            <div class="q-ml-sm row items-center no-wrap">
                <div class="klein-command">
                    klein download
                    <span style="opacity: 0.8"> --dest=. {{ file.uuid }} </span>
                </div>
                <q-btn
                    icon="sym_o_content_copy"
                    flat
                    aria-label="Copy CLI command"
                    class="klein-command__copy"
                    style="padding: 3px; color: #0f62fe; rotate: 180deg"
                    @click.stop="copyCommandAction"
                >
                    <q-tooltip>Copy CLI command</q-tooltip>
                </q-btn>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';

const { file } = defineProps<{
    file: FileWithTopicDto;
}>();

const copyCommandAction = async (): Promise<void> => {
    const text = `klein download --dest=. ${file.uuid}`;
    await navigator.clipboard.writeText(text);
};
</script>

<style scoped>
.klein-command__box {
    max-width: 100%;
}

/* One truncated line, as before, but it can no longer push the box wider */
.klein-command {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: smaller;
}

.klein-command__copy {
    flex: 0 0 auto;
}

/* On phones the command wraps instead of overflowing the page */
@media (max-width: 599px) {
    .klein-command {
        overflow: visible;
        white-space: normal;
        word-break: break-all;
        text-overflow: clip;
        padding: 4px 0;
    }
}
</style>
