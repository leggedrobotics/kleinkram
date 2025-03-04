<template>
    <title-section :title="`File: ${data?.filename || 'Loading...'}`">
        <template #buttons>
            <div style="width: 340px">
                <button-group>
                    <edit-file-button v-if="data" :file="data" />

                    <q-btn
                        class="button-border"
                        flat
                        icon="sym_o_download"
                        label="Download"
                        :disable="
                            [FileState.LOST, FileState.UPLOADING].includes(
                                data?.state ?? FileState.LOST,
                            )
                        "
                        @click="download"
                    />

                    <q-btn
                        flat
                        icon="sym_o_more_vert"
                        color="primary"
                        class="cursor-pointer button-border"
                        @click.stop
                    >
                        <q-menu v-if="data !== undefined" auto-close>
                            <q-list>
                                <q-item
                                    v-ripple
                                    clickable
                                    :disable="
                                        data?.state === FileState.LOST ||
                                        data?.state === FileState.ERROR
                                    "
                                    @click="_copyLink"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_content_copy" />
                                    </q-item-section>
                                    <q-item-section>
                                        Copy public link
                                    </q-item-section>
                                </q-item>

                                <q-item
                                    v-ripple
                                    clickable
                                    :disable="!data?.hash"
                                    @click="copy"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_encrypted" />
                                    </q-item-section>
                                    <q-item-section> Copy MD5</q-item-section>
                                </q-item>
                                <q-item
                                    v-ripple
                                    clickable
                                    @click="copyDataToClipboard"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_fingerprint" />
                                    </q-item-section>
                                    <q-item-section> Copy UUID</q-item-section>
                                </q-item>
                                <q-item v-ripple clickable style="color: red">
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_delete" />
                                    </q-item-section>
                                    <q-item-section>
                                        <DeleteFileDialogOpener
                                            v-if="data"
                                            :file="data"
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
                    <KleinDownloadFile v-if="data" :file="data" />
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
                            style="
                                font-size: 16px;
                                overflow: hidden;
                                text-overflow: ellipsis;
                            "
                        >
                            {{ data?.mission.name }}
                            <q-tooltip> {{ data?.mission.name }}</q-tooltip>
                        </div>
                    </div>
                    <div class="col-3">
                        <div v-if="data?.date">
                            <div class="text-placeholder">Start Date</div>
                            <div
                                class="text-caption text-primary"
                                style="font-size: 16px"
                            >
                                {{ formatDate(data?.date, true) }}
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
                                {{ data?.creator.name }}
                            </div>
                        </div>
                    </div>
                    <div class="col-1">
                        <div class="text-placeholder">File State</div>

                        <q-icon
                            :name="getIcon(data?.state ?? FileState.OK)"
                            :color="
                                getColorFileState(data?.state ?? FileState.OK)
                            "
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
                    v-if="displayTopics"
                    v-model="filterKey"
                    debounce="300"
                    placeholder="Search"
                    dense
                    outlined
                >
                    <template #append>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>
            </button-group>
        </div>

        <div style="padding-top: 10px">
            <q-table
                v-if="displayTopics"
                ref="tableReference"
                v-model:selected="selected"
                v-model:pagination="pagination"
                flat
                bordered
                separator="none"
                :rows="data?.topics ?? []"
                :columns="columns as any"
                row-key="uuid"
                :loading="isLoading"
                :filter="filterKey"
            />

            <div
                v-if="!displayTopics && data?.state === FileState.OK && !!mcap"
                class="flex column"
            >
                <span class="q-my-sm">
                    Kleinkram does ony extract topics for mcap files.
                    <br>Please switch to the mcap file to see the topics.
                </span>

                <q-btn
                    label="Go to Mcap"
                    flat
                    class="button-border"
                    style="width: 350px"
                    icon="sym_o_turn_slight_right"
                    @click="redirectToMcap"
                />
            </div>
            <div v-if="data?.state !== FileState.OK">
                <h5 style="margin-top: 10px; margin-bottom: 10px">
                    Queues related to this file
                </h5>
                This file has not yet completed uploading or processing.
                <q-separator style="margin-top: 6px; margin-bottom: 6px" />
                <div v-for="queue in queues?.data" :key="queue.uuid">
                    {{ queue.display_name }} -
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
import { formatDate } from '../services/date-formating';
import { computed, Ref, ref } from 'vue';
import { copyToClipboard, Notify, QTable } from 'quasar';
import ROUTES from 'src/router/routes';
import { downloadFile } from 'src/services/queries/file';
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
import { useRouter } from 'vue-router';
import {
    registerNoPermissionErrorHandler,
    useFile,
    useMcapFilesOfMission,
    useQueueForFile,
} from '../hooks/query-hooks';
import { formatSize } from '../services/general-formatting';
import { FileState, FileType } from '@common/enum';
import { useFileUUID, useMissionUUID } from '../hooks/router-hooks';
import DeleteFileDialogOpener from './button-wrapper/delete-file-dialog-opener.vue';
import ButtonGroup from './buttons/button-group.vue';
import EditFileButton from './buttons/edit-file-button.vue';
import KleinDownloadFile from './cli-links/klein-download-file.vue';
import TitleSection from './title-section.vue';

const $router = useRouter();

const selected = ref([]);

const filterKey = ref<string>('');
const tableReference: Ref<QTable | undefined> = ref(undefined);

const fileUuid = useFileUUID();
const { isLoading, data, error, isLoadingError } = useFile(fileUuid);
registerNoPermissionErrorHandler(isLoadingError, fileUuid, 'file', error);

const missionUUID = useMissionUUID();

const mcapName = computed(() => data.value?.filename.replace('.bag', '.mcap'));

const { data: _filesReturn } = useMcapFilesOfMission(
    missionUUID.value,
    mcapName.value ?? '',
);
const { data: queues } = useQueueForFile(
    data.value?.filename.replace(/\.(bag|mcap)$/, ''),
    data.value?.mission.uuid ?? '',
);

const filesReturn = computed(() =>
    _filesReturn.value ? _filesReturn.value.data : [],
);

const displayTopics = computed(() => {
    if (data.value === undefined) {
        return false;
    }

    return (
        data.value.type === FileType.MCAP && data.value.state === FileState.OK
    );
});
const mcap = computed(() =>
    filesReturn.value.length > 0 ? filesReturn.value[0] : undefined,
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
        format: (value: number) => Math.round(value * 100) / 100,
    },
];

async function redirectToMcap(): Promise<void> {
    if (mcap.value) {
        console.log(`Redirecting to mcap ${mcap.value.mission.project.uuid}`);
        await $router.push({
            name: ROUTES.FILE.routeName,
            params: {
                project_uuid: mcap.value.mission.project.uuid,
                mission_uuid: mcap.value.mission.uuid,
                file_uuid: mcap.value.uuid,
            },
        });
    }
}

async function _copyLink(): Promise<void> {
    const downloadLink = await downloadFile(fileUuid.value ?? '', false);
    await copyToClipboard(downloadLink);
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

const copy = async (): Promise<void> => {
    await copyToClipboard(data.value?.hash ?? '');
};
const download = async (): Promise<void> => {
    await _downloadFile(data.value?.uuid ?? '', data.value?.filename ?? '');
};

const copyDataToClipboard = async (): Promise<void> => {
    await copyToClipboard(data.value?.uuid ?? '');
};
</script>
