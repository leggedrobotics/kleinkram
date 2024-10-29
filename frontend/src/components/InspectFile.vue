<template>
    <title-section :title="`File: ${data?.filename || 'Loading...'}`">
        <template v-slot:buttons>
            <div style="width: 340px">
                <button-group>
                    <edit-file-button :file="data" v-if="data" />

                    <q-btn
                        class="button-border"
                        flat
                        icon="sym_o_download"
                        label="Download"
                        @click="() => _downloadFile(data?.uuid, data?.filename)"
                        :disable="
                            [FileState.LOST, FileState.UPLOADING].indexOf(
                                data?.state,
                            ) !== -1
                        "
                    />

                    <q-btn
                        flat
                        icon="sym_o_more_vert"
                        color="primary"
                        class="cursor-pointer button-border"
                        @click.stop
                    >
                        <q-menu auto-close>
                            <q-list>
                                <q-item
                                    clickable
                                    v-ripple
                                    @click="(e) => _copyLink()"
                                    :disable="
                                        data?.state === FileState.LOST ||
                                        data?.state === FileState.ERROR
                                    "
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_content_copy" />
                                    </q-item-section>
                                    <q-item-section>
                                        Copy public link
                                    </q-item-section>
                                </q-item>

                                <q-item
                                    clickable
                                    v-ripple
                                    :disable="!data?.hash"
                                    @click="(e) => copyToClipboard(data?.hash)"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_encrypted" />
                                    </q-item-section>
                                    <q-item-section> Copy MD5</q-item-section>
                                </q-item>
                                <q-item
                                    clickable
                                    v-ripple
                                    @click="() => copyToClipboard(data?.uuid)"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_fingerprint" />
                                    </q-item-section>
                                    <q-item-section> Copy UUID</q-item-section>
                                </q-item>
                                <q-item clickable v-ripple style="color: red">
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_delete" />
                                    </q-item-section>
                                    <q-item-section>
                                        <DeleteFileDialogOpener
                                            :file="data"
                                            v-if="data"
                                        >
                                            Delete File
                                        </DeleteFileDialogOpener>
                                    </q-item-section>
                                </q-item>
                            </q-list>
                        </q-menu>
                    </q-btn>
                </button-group>
                <div class="flex row">
                    <KleinDownloadFile :file="data" v-if="data" />
                </div>
            </div>
        </template>

        <template #subtitle>
            <div class="q-gutter-md q-mt-xs">
                <div class="row items-start">
                    <div class="col-2">
                        <div class="text-placeholder">Project</div>
                        <div
                            class="text-caption text-primary"
                            style="font-size: 16px"
                        >
                            {{ data?.mission.project.name }}
                        </div>
                    </div>
                    <div class="col-2">
                        <div class="text-placeholder">Mission</div>
                        <div
                            class="text-caption text-primary"
                            style="font-size: 16px"
                        >
                            {{ data?.mission.name }}
                        </div>
                    </div>
                    <div class="col-3">
                        <div v-if="data?.date">
                            <div class="text-placeholder">Start Date</div>
                            <div
                                class="text-caption text-primary"
                                style="font-size: 16px"
                            >
                                {{ formatDate(data.date, true) }}
                            </div>
                        </div>
                    </div>
                    <div class="col-2">
                        <div v-if="data?.creator">
                            <div class="text-placeholder">Creator</div>
                            <div
                                class="text-caption text-primary"
                                style="font-size: 16px"
                            >
                                {{ data.creator.name }}
                            </div>
                        </div>
                    </div>
                    <div class="col-1">
                        <div class="text-placeholder">File State</div>

                        <q-icon
                            :name="getIcon(data?.state)"
                            :color="getColorFileState(data?.state)"
                            style="font-size: 24px"
                        >
                            <q-tooltip>
                                {{ getTooltip(data?.state) }}
                            </q-tooltip>
                        </q-icon>
                    </div>
                    <div class="col-1">
                        <div class="text-placeholder">Size</div>
                        <div
                            class="text-caption text-primary"
                            style="font-size: 16px"
                        >
                            {{ data?.size ? formatSize(data?.size) : '...' }}
                        </div>
                    </div>
                </div>
                <div class="row items-start">
                    <q-chip
                        v-for="cat in data?.categories"
                        :key="cat.uuid"
                        :label="cat.name"
                        :color="hashUUIDtoColor(cat.uuid)"
                        style="color: white; font-size: smaller"
                    />
                </div>
            </div>
        </template>
    </title-section>

    <div class="q-my-lg">
        <div class="flex justify-between items-center">
            <h2 class="text-h4 q-mb-xs">All ROS Topics</h2>

            <button-group>
                <q-input
                    debounce="300"
                    placeholder="Search"
                    dense
                    v-model="filterKey"
                    v-if="displayTopics"
                    outlined
                >
                    <template v-slot:append>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>
            </button-group>
        </div>

        <div style="padding-top: 10px">
            <q-table
                flat
                bordered
                separator="none"
                v-model:selected="selected"
                v-if="displayTopics"
                ref="tableoniRef"
                v-model:pagination="pagination"
                :rows="data?.topics"
                :columns="columns"
                row-key="uuid"
                :loading="isLoading"
                :filter="filterKey"
            >
            </q-table>

            <div
                class="flex column"
                v-if="!displayTopics && data?.state === FileState.OK && !!mcap"
            >
                <span class="q-my-sm">
                    Kleinkram does ony extract topics for mcap files.
                    <br />Please switch to the mcap file to see the topics.
                </span>

                <q-btn
                    label="Go to Mcap"
                    flat
                    class="button-border"
                    style="width: 350px"
                    icon="sym_o_turn_slight_right"
                    @click="redirectToMcap"
                >
                </q-btn>
            </div>
            <div v-if="data?.state !== FileState.OK">
                <h5 style="margin-top: 10px; margin-bottom: 10px">
                    Queues related to this file
                </h5>
                This file has not yet completed uploading or processing.
                <q-separator style="margin-top: 6px; margin-bottom: 6px" />
                <div v-for="queue in queues">
                    {{ queue.filename }} -
                    <q-badge :color="getColor(queue.state)">
                        <q-tooltip>
                            {{ getDetailedFileState(queue.state) }}
                        </q-tooltip>
                        {{ getSimpleFileStateName(queue.state) }}
                    </q-badge>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { formatDate } from 'src/services/dateFormating';
import { computed, Ref, ref } from 'vue';
import { copyToClipboard, Notify, QTable, useQuasar } from 'quasar';
import { FileState, FileType } from 'src/enums/FILE_ENUM';
import ROUTES from 'src/router/routes';
import { FileEntity } from 'src/types/FileEntity';
import {
    downloadFile,
    fetchFile,
    filesOfMission,
} from 'src/services/queries/file';
import ButtonGroup from 'components/ButtonGroup.vue';
import DeleteFileDialogOpener from 'components/buttonWrapper/DeleteFileDialogOpener.vue';
import { getQueueForFile } from 'src/services/queries/queue';
import { Queue } from 'src/types/Queue';
import {
    _downloadFile,
    getColor,
    getColorFileState,
    getDetailedFileState,
    getIcon,
    getSimpleFileStateName,
    getTooltip,
    hashUUIDtoColor,
} from '../services/generic';
import { useMissionUUID } from 'src/hooks/utils';
import { useRouter } from 'vue-router';
import TitleSection from 'components/TitleSection.vue';
import { registerNoPermissionErrorHandler } from 'src/hooks/customQueryHooks';
import EditFileButton from 'components/buttons/EditFileButton.vue';
import KleinDownloadFile from 'components/CLILinks/KleinDownloadFile.vue';
import { formatSize } from 'src/services/generalFormatting';

const $router = useRouter();
const $q = useQuasar();

const props = defineProps<{
    uuid: string;
}>();
const selected = ref([]);

const file_uuid = computed(() => props.uuid);
const filterKey = ref<string>('');
const tableoniRef: Ref<QTable | null> = ref(null);

const {
    isLoading,
    data,
    error,
    isLoadingError,
}: {
    isLoading: Ref<boolean>;
    data: Ref<FileEntity>;
    error: any;
    isLoadingError: any;
} = useQuery<FileEntity>({
    queryKey: ['file', file_uuid],
    queryFn: () => fetchFile(file_uuid.value),
    retryDelay: 200,
    throwOnError(error, query) {
        console.log('errsdfor: ', error);
        Notify.create({
            message: `Error fetching file: ${error.response?.data.message}`,
            color: 'negative',
            timeout: 2000,
            position: 'bottom',
        });
        $router.push(ROUTES.DATATABLE.routeName);
        return false;
    },
});
registerNoPermissionErrorHandler(isLoadingError, file_uuid, 'file', error);

const missionUUID = useMissionUUID();

const mcap_name = computed(() => data.value?.filename.replace('.bag', '.mcap'));
const _queryKey = computed(() => ['files', missionUUID.value, mcap_name.value]);

const { data: _filesReturn, refetch } = useQuery({
    queryKey: _queryKey,
    queryFn: () =>
        filesOfMission(
            missionUUID.value || '',
            100,
            0,
            FileType.MCAP,
            mcap_name.value,
        ),
    enabled() {
        return !!missionUUID.value;
    },
});
const queueKey = computed(() => ['queue', data.value?.filename]);
const { data: queues } = useQuery<Queue[]>({
    queryKey: queueKey,
    queryFn: () =>
        getQueueForFile(
            data.value?.filename.replace(/\.(bag|mcap)$/, '') || '',
            data.value?.mission?.uuid || '',
        ),
});

const filesReturn = computed(() =>
    _filesReturn.value ? _filesReturn.value[0] : [],
);

const displayTopics = computed(() => {
    return (
        data.value?.type === FileType.MCAP && data.value?.state === FileState.OK
    );
});
const mcap = computed(() =>
    filesReturn.value.length > 0 ? filesReturn.value[0] : null,
);

const columns = [
    {
        name: 'Topic',
        label: 'Topic',
        field: 'name',
        sortable: true,
        align: 'left',
    },
    { name: 'Datatype', label: 'Datatype', field: 'type', sortable: true },
    {
        name: 'NrMessages',
        label: 'NrMessages',
        field: 'nrMessages',
        sortable: true,
    },
    {
        name: 'Frequency',
        label: 'Frequency',
        field: (row: any) => row.frequency || 0,
        sortable: true,
        format: (val: number) => Math.round(val * 100) / 100,
    },
];

function redirectToMcap() {
    if (mcap.value) {
        $router.push({
            name: ROUTES.FILE.routeName,
            params: {
                mission_uuid: mcap.value?.mission?.uuid,
                project_uuid: mcap.value?.mission?.project?.uuid,
                file_uuid: mcap.value?.uuid,
            },
        });
    }
}

async function _copyLink() {
    const res = await downloadFile(props.uuid, false);
    await copyToClipboard(res);
    Notify.create({
        group: false,
        message: 'Copied: Link valid for 7 days',
        color: 'positive',
        position: 'bottom',
        timeout: 2000,
    });
}

const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 20,
});
</script>
<style scoped>
@import 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
@import 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0';
</style>
