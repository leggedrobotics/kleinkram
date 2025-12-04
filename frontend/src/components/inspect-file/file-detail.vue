<template>
    <FileHeader
        v-if="file"
        :file="file"
        @download="handleDownload"
        @copy-link="copyPublicLink"
        @copy-hash="copyHash"
        @copy-uuid="copyUuid"
        @copy-foxglove="copyFoxgloveLink"
    />

    <div v-if="file" class="q-my-lg">
        <!-- YAML/Text Preview -->
        <div v-if="isYaml" class="q-mb-lg">
            <h2 class="text-h4 q-mb-md">Content Preview</h2>
            <div
                v-if="yamlContent"
                class="bg-grey-1 q-pa-md rounded-borders border-solid"
            >
                <pre class="q-ma-none text-code" style="overflow-x: auto">{{
                    yamlContent
                }}</pre>
            </div>
            <div v-else class="row items-center q-gutter-sm text-grey-7">
                <q-spinner-dots size="1.5em" /> <span>Loading content...</span>
            </div>
        </div>

        <!-- TUM Preview -->
        <div v-else-if="isTum" class="q-mb-lg">
            <h2 class="text-h4 q-mb-md flex items-center">
                Trajectory Preview
                <q-badge
                    color="orange-7"
                    text-color="white"
                    label="BETA"
                    class="text-weight-bold cursor-help q-ml-sm"
                    style="
                        font-size: 10px;
                        padding: 2px 6px;
                        vertical-align: middle;
                    "
                >
                    <q-tooltip>
                        Preview functionality is currently in beta.
                    </q-tooltip>
                </q-badge>
            </h2>
            <div v-if="tumContent">
                <TumViewer :content="tumContent ?? ''" />
            </div>
            <div v-else class="row items-center q-gutter-sm text-grey-7">
                <q-spinner-dots size="1.5em" /> <span>Loading content...</span>
            </div>
        </div>

        <!-- SVO2 Preview -->
        <div v-else-if="isSvo2" class="q-mb-lg">
            <Svo2Viewer :url="svo2Url" @download="handleDownload" />
        </div>

        <!-- Binary/ROS Preview -->
        <div v-else-if="displayTopics">
            <FileTopicTable
                :topics="file.topics"
                :is-loading="isLoading"
                :previews="preview.topicPreviews"
                :loading-state="preview.topicLoadingState"
                :topic-errors="preview.topicErrors"
                @load-preview="preview.fetchTopicMessages"
                @pause-preview="preview.cancelTopic"
                @resume-preview="handleResumePreview"
            />

            <div
                v-if="
                    (preview.dbSchema || isLoading) &&
                    (!file.topics || file.topics.length === 0)
                "
                class="q-mt-lg"
            >
                <h3 class="text-h5 q-mb-md">SQL Schema</h3>
                <div
                    v-if="isLoading"
                    class="row justify-center q-pa-md bg-grey-1 rounded-borders"
                >
                    <q-spinner color="primary" size="2em" />
                    <span class="q-ml-sm">Loading schema...</span>
                </div>
                <div
                    v-else-if="preview.dbSchema?.value"
                    class="bg-grey-1 q-pa-md rounded-borders border-solid"
                >
                    <pre class="q-ma-none text-code" style="overflow-x: auto">{{
                        preview.dbSchema.value
                            ?.replace(/CREATE TABLE/g, '\nCREATE TABLE')
                            .trim()
                    }}</pre>
                </div>
            </div>
        </div>

        <!-- Uploading Placeholder -->
        <div
            v-else-if="file.state === FileState.UPLOADING"
            class="text-center q-pa-xl bg-grey-1 rounded-borders border-dashed text-grey-7"
        >
            <q-icon name="sym_o_cloud_upload" size="4em" class="q-mb-md" />
            <div class="text-h6">No preview available while uploading</div>
        </div>

        <!-- Fallback / Unsupported / Error -->
        <div v-else-if="!displayTopics && !isLoading">
            <FileErrorState :file="file" />
        </div>

        <FileHistory v-if="events !== undefined" :events="events" />

        <div
            v-if="preview.readerError.value"
            class="q-my-md text-negative text-center"
        >
            <q-icon name="sym_o_warning" /> {{ preview.readerError.value }}
        </div>
    </div>

    <div v-else class="text-center q-pa-md">
        <q-spinner size="3em" color="primary" />
        <div class="text-grey q-mt-sm">Loading file...</div>
    </div>
</template>

<script setup lang="ts">
import { FileState, FileType } from '@kleinkram/shared';
import { copyToClipboard, Notify } from 'quasar';
import { useRosmsgPreview } from 'src/composables/use-rosmsg-preview';
import {
    registerNoPermissionErrorHandler,
    useFile,
    useFileEvents,
} from 'src/hooks/query-hooks';
import { useFileUUID } from 'src/hooks/router-hooks';
import { _downloadFile } from 'src/services/generic';
import { downloadFile, getFoxgloveLink } from 'src/services/queries/file';
import { computed, onUnmounted, ref, watch } from 'vue';
import FileErrorState from './file-error-state.vue';
import FileHeader from './file-header.vue';
import FileHistory from './file-history.vue';
import FileTopicTable from './file-topic-table.vue';
import Svo2Viewer from './viewers/svo2-viewer.vue';
import TumViewer from './viewers/tum-viewer.vue';

const fileUuid = useFileUUID();
const { isLoading, data: file, error, isLoadingError } = useFile(fileUuid);
registerNoPermissionErrorHandler(isLoadingError, fileUuid, 'file', error);
const { data: events } = useFileEvents(fileUuid);

const preview = useRosmsgPreview();
const yamlContent = ref<string | undefined>(undefined);
const tumContent = ref<string | undefined>(undefined);
const svo2Url = ref<string | undefined>(undefined);

const fileExtension = computed(
    () => file.value?.filename?.split('.').pop()?.toLowerCase() ?? '',
);
const isYaml = computed(
    () =>
        ['yml', 'yaml'].includes(fileExtension.value) &&
        file.value?.state === FileState.OK,
);
const isTum = computed(
    () =>
        file.value?.type === FileType.TUM && file.value?.state === FileState.OK,
);
const isSvo2 = computed(
    () =>
        file.value?.type === FileType.SVO2 &&
        file.value?.state === FileState.OK,
);
const isSupportedBinary = computed(() => {
    if (!file.value) return false;
    return (
        file.value.type === FileType.BAG ||
        file.value.type === FileType.MCAP ||
        file.value.type === FileType.DB3
    );
});
const displayTopics = computed(
    () => file.value?.state === FileState.OK && isSupportedBinary.value,
);

// --- Init ---
watch(
    () => file.value,
    async (currentFile) => {
        if (
            !currentFile ||
            currentFile.state !== FileState.OK ||
            preview.isReaderReady.value
        )
            return;

        try {
            const url = await downloadFile(currentFile.uuid, false, true);

            if (isYaml.value) {
                const results = await fetch(url);
                yamlContent.value = results.ok
                    ? await results.text()
                    : 'Error loading content';
            } else if (isTum.value) {
                const results = await fetch(url);
                tumContent.value = results.ok
                    ? await results.text()
                    : 'Error loading content';
            } else if (isSvo2.value) {
                // For SVO2, we just need the URL to be available for the viewer
                // The viewer will handle the range requests
                svo2Url.value = url;
            } else if (isSupportedBinary.value) {
                let type: 'rosbag' | 'mcap' | 'db3';
                if (currentFile.type === FileType.BAG) type = 'rosbag';
                else if (currentFile.type === FileType.MCAP) type = 'mcap';
                else type = 'db3';
                await preview.init(url, type);
            }
        } catch (error_) {
            console.error(error_);
        }
    },
    { immediate: true },
);

onUnmounted(() => {
    preview.reset();
});

// --- Actions ---
const handleDownload = (): Promise<void> =>
    _downloadFile(file.value?.uuid ?? '', file.value?.filename ?? '');
const copyHash = (): Promise<void> => copyToClipboard(file.value?.hash ?? '');
const copyUuid = (): Promise<void> => copyToClipboard(file.value?.uuid ?? '');
async function copyFoxgloveLink(): Promise<void> {
    if (!file.value?.uuid) return;

    try {
        // 1. Fetch the signed proxy URL from the backend
        const link = await getFoxgloveLink(file.value.uuid);

        // 2. Copy to clipboard
        await copyToClipboard(link);

        // 3. Notify user
        Notify.create({
            message:
                'Foxglove link copied! Paste this URL via "Open remote file" in Foxglove.',
            color: 'positive',
            icon: 'sym_o_check',
            timeout: 4000,
        });
    } catch (foxgloveLinkError: unknown) {
        console.error(foxgloveLinkError);
        Notify.create({
            message: 'Failed to generate Foxglove link',
            color: 'negative',
            icon: 'sym_o_warning',
        });
    }
}
async function copyPublicLink(): Promise<void> {
    if (!fileUuid.value) return;
    const link = await downloadFile(fileUuid.value, false);
    await copyToClipboard(link);
    Notify.create({
        message: 'Copied: Link valid for 7 days',
        color: 'positive',
    });
}

function handleResumePreview(t: string, limit: number) {
    void preview.fetchTopicMessages(t, { append: true, limit });
}
</script>

<style scoped>
.text-code {
    font-family: monospace;
    font-size: 13px;
}
.border-solid {
    border: 1px solid #e0e0e0;
}
.border-dashed {
    border: 2px dashed #e0e0e0;
}
</style>
