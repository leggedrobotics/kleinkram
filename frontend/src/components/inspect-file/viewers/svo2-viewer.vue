<template>
    <div class="svo2-viewer bg-grey-1 rounded-borders q-pa-xl text-center">
        <q-icon name="sym_o_videocam" size="4em" class="text-grey-7 q-mb-md" />
        <div class="text-h6 text-grey-9">ZED SVO2 Video Recording</div>
        <div
            class="text-body1 text-grey-7 q-mt-sm"
            style="max-width: 600px; margin: 0 auto"
        >
            This file contains high-fidelity video and sensor data recorded with a
            ZED camera.
            <br>
            Preview is not supported in the browser.
        </div>

        <div class="q-mt-lg row justify-center q-gutter-md">
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
const emit = defineEmits<(event: 'download') => void>();

function onDownload(): void {
    emit('download');
}
</script>
