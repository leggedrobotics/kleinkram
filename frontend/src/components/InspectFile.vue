<template>
    <q-card>
        <q-card-section>
            <div class="text-h4 q-mb-md">{{ data?.filename }}</div>
            <q-separator class="q-my-xs q-mb-md"></q-separator>
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
                    <div class="col-1">
                        <q-btn
                            flat
                            label="Download"
                            icon="cloud_download"
                            @click="_downloadBag"
                            class="full-width"
                        ></q-btn>
                    </div>
                    <div class="col-2">
                        <q-btn
                            flat
                            label="Copy public link"
                            icon="content_copy"
                            @click="_copyLink"
                            class="full-width"
                        ></q-btn>
                    </div>
                </div>
            </div>
        </q-card-section>

        <q-card-section>
            <QTable
                v-if="data?.type === FileType.MCAP"
                ref="tableoniRef"
                v-model:pagination="pagination"
                title="Topics"
                :rows="data?.topics"
                :columns="columns"
                row-key="uuid"
                :loading="isLoading"
            >
            </QTable>
            <q-btn
                v-else
                label="Got to Mcap"
                icon="turn_slight_right"
                @click="redirectToMcap"
            >
            </q-btn>
        </q-card-section>
    </q-card>
</template>
<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { downloadBag, fetchFile, filesOfMission } from 'src/services/queries';
import { FileEntity, Mission } from 'src/types/types';
import { formatDate } from 'src/services/dateFormating';
import { computed, inject, Ref, ref, watch, watchEffect } from 'vue';
import { copyToClipboard, Notify, QTable } from 'quasar';
import { FileType } from 'src/enum/FILE_ENUM';
import RouterService from 'src/services/routerService';
import ROUTES from 'src/router/routes';
const $routerService: RouterService | undefined = inject('$routerService');

const props = defineProps<{
    file_uuid: string;
}>();

const file_uuid = computed(() => props.file_uuid);

const tableoniRef: Ref<QTable | null> = ref(null);

const { isLoading, isError, data, error } = useQuery<FileEntity>({
    queryKey: ['file', file_uuid],
    queryFn: () => fetchFile(file_uuid.value),
});

const missionUUID = computed(() => data.value?.mission.uuid);

const { data: filesReturn, refetch } = useQuery({
    queryKey: ['files', missionUUID.value],
    queryFn: () => filesOfMission(missionUUID.value || ''),
    enabled() {
        return !!missionUUID.value;
    },
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
async function _downloadBag() {
    const res = await downloadBag(props.file_uuid, true);
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
    const res = await downloadBag(props.file_uuid, false);
    await copyToClipboard(res);
    Notify.create({
        group: false,
        message: 'Copied: Link valid for 7 days',
        color: 'positive',
        position: 'top-right',
        timeout: 2000,
    });
}

const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 10,
});
</script>
<style scoped></style>
