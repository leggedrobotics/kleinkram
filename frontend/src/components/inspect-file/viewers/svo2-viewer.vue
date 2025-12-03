<template>
    <div class="svo2-viewer bg-grey-1 rounded-borders q-pa-lg text-center">
        <div class="text-h6 q-mb-md">Preview Not Supported</div>
        <div class="text-body1 q-mb-lg text-grey-8">
            Previewing SV02 files in Kleinkarm is not yet supported. Please
            download the file to view it using the ZED SDK tools.
        </div>

        <div class="row justify-center q-gutter-md">
            <q-btn
                label="Download File"
                color="primary"
                icon="sym_o_download"
                @click="onDownload"
            />
            <q-btn
                label="Learn about SVO2"
                outline
                color="primary"
                icon="sym_o_info"
                href="https://www.stereolabs.com/docs/video/svo-file/"
                target="_blank"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    url?: string | undefined;
}>();

const emit = defineEmits<(event: 'download') => void>();

function onDownload(): void {
    emit('download');
}
</script>

<style scoped>
.svo2-viewer {
    border: 1px solid #e0e0e0;
}
</style>
