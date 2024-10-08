<template>
    <div style="width: 100%">
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
                        color: white;
                    "
                >
                    klein file download
                    <span style="color: #b1b1b1">
                        {{ fileArguments }} --local-path="."
                    </span>
                </div>
                <q-btn
                    icon="sym_o_content_copy"
                    flat
                    style="padding: 3px; color: white; rotate: 180deg"
                    @click.stop="clicked"
                />
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { FileEntity } from 'src/types/FileEntity';
import { computed } from 'vue';

const props = defineProps<{
    files: FileEntity[];
}>();

const fileArguments = computed(() => {
    return props.files
        .map((file) => {
            return `--file-uuid="${file.uuid}"`;
        })
        .join(' ');
});

function clicked() {
    const text = `klein file download ${fileArguments.value} --local-path="."`;
    navigator.clipboard.writeText(text);
}
</script>
<style scoped></style>
