<template>
    <div class="q-mb-md q-mt-xl">
        <div class="flex justify-between q-mv-md">
            <div />

            <ButtonGroup>
                <q-btn
                    outline
                    color="primary"
                    icon="sym_o_edit"
                    label="Edit File"
                    @click="editFile"
                    :disable="data?.tentative"
                >
                    <q-tooltip> Edit File</q-tooltip>
                </q-btn>
                <q-btn
                    color="primary"
                    icon="sym_o_download"
                    label="Download"
                    @click="_downloadFile"
                    :disable="data?.tentative"
                >
                    <q-tooltip> Download File</q-tooltip>
                </q-btn>
                <q-btn
                    outline
                    icon="sym_o_more_vert"
                    color="primary"
                    class="cursor-pointer"
                    @click.stop
                >
                    <q-menu auto-close>
                        <q-list>
                            <q-item
                                clickable
                                v-ripple
                                @click="(e) => _copyLink()"
                                :disable="data?.tentative"
                            >
                                <q-item-section
                                    >Copy public link
                                </q-item-section>
                            </q-item>
                            <q-item clickable v-ripple>
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
            </ButtonGroup>
        </div>
    </div>

    <q-card class="q-pa-md q-mb-md" flat bordered>
        <q-card-section>
            <div class="text-h4 q-mb-md">File: {{ data?.filename }}</div>
            <q-separator class="q-mt-md" />
            <div class="q-gutter-md q-mt-xs">
                <div class="row items-start">
                    <div class="col-2">
                        <div class="text-subtitle3">Project</div>
                        <div
                            class="text-caption text-primary"
                            style="font-size: 16px"
                        >
                            {{ data?.mission.project.name }}
                        </div>
                    </div>
                    <div class="col-2">
                        <div class="text-subtitle3">Mission</div>
                        <div
                            class="text-caption text-primary"
                            style="font-size: 16px"
                        >
                            {{ data?.mission.name }}
                        </div>
                    </div>
                    <div class="col-3">
                        <div v-if="data?.date">
                            <div class="text-subtitle3">Start Date</div>
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
                            <div class="text-subtitle3">Creator</div>
                            <div
                                class="text-caption text-primary"
                                style="font-size: 16px"
                            >
                                {{ data.creator.name }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </q-card-section>
    </q-card>

    <q-card class="q-pa-md q-mb-xl" flat bordered>
        <q-card-section>
            <q-input
                v-model="filterKey"
                filled
                placeholder="Search"
                class="q-mb-md"
                v-if="displayTopics"
            />
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
                selection="multiple"
                :loading="isLoading"
                :filter="filterKey"
            >
            </q-table>
            <q-btn
                v-if="!displayTopics && !data?.tentative"
                label="Got to Mcap"
                icon="sym_o_turn_slight_right"
                @click="redirectToMcap"
            >
            </q-btn>
            <div v-if="data?.tentative">
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
        </q-card-section>
    </q-card>
</template>
<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { formatDate } from 'src/services/dateFormating';
import { computed, inject, Ref, ref, watch } from 'vue';
import { copyToClipboard, Notify, QTable, useQuasar } from 'quasar';
import { FileType } from 'src/enums/FILE_ENUM';
import RouterService from 'src/services/routerService';
import ROUTES from 'src/router/routes';
import { FileEntity } from 'src/types/FileEntity';
import {
    downloadFile,
    fetchFile,
    filesOfMission,
} from 'src/services/queries/file';
import ButtonGroup from 'components/ButtonGroup.vue';
import EditFile from 'components/EditFile.vue';
import DeleteFileDialogOpener from 'components/buttonWrapper/DeleteFileDialogOpener.vue';
import { getQueueForFile } from 'src/services/queries/queue';
import { Queue } from 'src/types/Queue';
import {
    getColor,
    getDetailedFileState,
    getSimpleFileStateName,
} from '../services/generic';
import { getMe } from 'src/services/queries/user';

const $routerService: RouterService | undefined = inject('$routerService');
const $q = useQuasar();

const props = defineProps<{
    uuid: string;
}>();
const selected = ref([]);

const file_uuid = computed(() => props.uuid);
const filterKey = ref<string>('');
const tableoniRef: Ref<QTable | null> = ref(null);
//
// //get Current User:
// const { data: user } = useQuery({
//     queryKey: ['me'],
//     queryFn: () => getMe(),
// });

const { isLoading, isError, data, error } = useQuery<FileEntity>({
    queryKey: ['file', file_uuid],
    queryFn: () => fetchFile(file_uuid.value),
    retryDelay: 200,
    throwOnError(error, query) {
        console.log('errsdfor: ', error);
        Notify.create({
            message: `Error fetching file: ${error.response?.data.message}`,
            color: 'negative',
            timeout: 2000,
            position: 'top-right',
        });
        $routerService?.routeTo(ROUTES.DATATABLE);
        return false;
    },
});

const missionUUID = computed(() => data.value?.mission?.uuid);

const { data: _filesReturn, refetch } = useQuery({
    queryKey: ['files', missionUUID.value],
    queryFn: () => filesOfMission(missionUUID.value || '', 100, 0),
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
    return data.value?.type === FileType.MCAP && !data.value?.tentative;
});

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
        field: 'frequency',
        sortable: true,
    },
];

const downloadURL = ref<string>('');

async function _downloadFile() {
    const res = await downloadFile(props.uuid, true);
    const a = document.createElement('a');
    a.href = res;
    a.download = data.value?.filename || 'file.mcap'; // Optionally set the file name for the download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function redirectToMcap() {
    const mcap = filesReturn.value?.find((file: FileEntity) => {
        return file.filename === data.value?.filename.replace('.bag', '.mcap');
    });
    if (mcap && $routerService) {
        await $routerService.routeTo(ROUTES.FILE, { uuid: mcap.uuid });
    }
}

async function _copyLink() {
    const res = await downloadFile(props.uuid, false);
    await copyToClipboard(res);
    Notify.create({
        group: false,
        message: 'Copied: Link valid for 7 days',
        color: 'positive',
        position: 'top-right',
        timeout: 2000,
    });
}

function editFile() {
    $q.dialog({
        component: EditFile,
        componentProps: {
            file_uuid: props.uuid,
        },
        persistent: true,
    });
}

const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 20,
});
</script>
<style scoped></style>
