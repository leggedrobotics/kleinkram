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
        <div class="button-border">
            <div class="q-ml-sm row items-center no-wrap">
                <div
                    class="text-truncate"
                    style="
                        flex: 1 1 auto;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        font-size: smaller;
                    "
                >
                    klein download
                    <span style="opacity: 0.8"> --dest=. {{ file.uuid }} </span>
                </div>
                <q-btn
                    icon="sym_o_content_copy"
                    flat
                    style="padding: 3px; color: #0f62fe; rotate: 180deg"
                    @click.stop="copyCommandAction"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { FileWithTopicDto } from '@api/types/file/file.dto';

const { file } = defineProps<{
    file: FileWithTopicDto;
}>();

const copyCommandAction = async (): Promise<void> => {
    const text = `klein download --dest=. ${file.uuid}`;
    await navigator.clipboard.writeText(text);
};
</script>
