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
                    klein download
                    <span style="opacity: 0.8">
                        --dest=. {{ fileArguments }}
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
import { computed } from 'vue';
import { FileDto } from '@api/types/Files.dto';

const props = defineProps<{
    files: FileDto[];
}>();

const fileArguments = computed(() => {
    return props.files
        .map((file) => {
            return file.uuid.toString();
        })
        .join(' ');
});

const clicked = async (): Promise<void> => {
    const text = `klein download --dest=. ${fileArguments.value}`;
    await navigator.clipboard.writeText(text);
};
</script>
<style scoped></style>
