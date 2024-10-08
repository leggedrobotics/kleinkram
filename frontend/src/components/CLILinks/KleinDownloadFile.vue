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
                    klein file download
                    <span style="color: grey">
                        --file-uuid="{{ props.file.uuid }}" --local-path="./{{
                            props.file.filename
                        }}"
                    </span>
                </div>
                <q-btn
                    icon="sym_o_content_copy"
                    flat
                    style="padding: 3px; color: #0f62fe; rotate: 180deg"
                    @click.stop="clicked"
                />
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { FileEntity } from 'src/types/FileEntity';

const props = defineProps<{
    file: FileEntity;
}>();

function clicked() {
    const text = `klein file download --file-uuid="${props.file.uuid}" --local-path="./${props.file.filename}"`;
    navigator.clipboard.writeText(text);
}
</script>
<style scoped></style>
