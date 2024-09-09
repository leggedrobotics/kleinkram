<template>
    <title-section :title="mission?.name">
        <template v-slot:subtitle>
            <div>
                <div class="flex justify-between items-center">
                    <div>
                        <div class="flex">
                            <span
                                v-for="tag in mission?.tags"
                                :key="tag.uuid"
                                class="q-mr-xs"
                            >
                                <q-chip
                                    square
                                    color="gray"
                                    @mouseup="() => openLink(tag)"
                                >
                                    {{ tag.type.name }}:
                                    {{ tag.asString() }}
                                </q-chip>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <template v-slot:buttons>
            <button-group>
                <q-btn
                    outline
                    color="primary"
                    icon="sym_o_analytics"
                    label="Actions"
                    @click="
                        $router.push({
                            name: ROUTES.ACTION.routeName,
                            query: {
                                project_uuid: project_uuid,
                                mission_uuid: mission_uuid,
                            },
                        })
                    "
                >
                    <q-tooltip> Analyze Actions</q-tooltip>
                </q-btn>

                <q-btn
                    outline
                    color="primary"
                    icon="sym_o_sell"
                    label="Metadata"
                    @click="openTagsDialog"
                >
                    <q-tooltip> Manage Metadata Tags</q-tooltip>
                </q-btn>

                <q-btn icon="sym_o_more_vert" outline>
                    <q-tooltip> More Actions</q-tooltip>

                    <q-menu auto-close style="width: 280px">
                        <q-list>
                            <move-mission-dialog-opener
                                v-if="mission"
                                :mission="mission"
                            >
                                <q-item clickable v-close-popup>
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_move_down" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-section>
                                            Move Mission
                                        </q-item-section>
                                    </q-item-section>
                                </q-item>
                            </move-mission-dialog-opener>

                            <q-item clickable v-close-popup disable>
                                <q-item-section avatar>
                                    <q-icon name="sym_o_lock" />
                                </q-item-section>
                                <q-item-section>
                                    <q-item-section>
                                        Manage Access
                                    </q-item-section>
                                </q-item-section>
                            </q-item>

                            <q-item clickable v-close-popup disable>
                                <q-item-section avatar>
                                    <q-icon name="sym_o_edit" />
                                </q-item-section>
                                <q-item-section>
                                    <q-item-section>
                                        Edit Mission
                                    </q-item-section>
                                </q-item-section>
                            </q-item>

                            <delete-mission-dialog-opener
                                :mission_uuid="mission.uuid"
                            >
                                <q-item
                                    clickable
                                    v-close-popup
                                    style="color: red"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_delete" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-section>
                                            Delete Mission
                                        </q-item-section>
                                    </q-item-section>
                                </q-item>
                            </delete-mission-dialog-opener>
                        </q-list>
                    </q-menu>
                </q-btn>
            </button-group>
        </template>
    </title-section>

    <div>
        <div
            class="q-my-lg flex justify-between items-center"
            v-if="selectedFiles.length === 0"
        >
            <Suspense>
                <TableHeader :url_handler="handler" v-if="handler" />

                <template #fallback>
                    <div style="width: 550px; height: 67px">
                        <q-skeleton
                            class="q-mr-md q-mb-sm q-mt-sm"
                            style="width: 300px; height: 20px"
                        />
                        <q-skeleton
                            class="q-mr-md"
                            style="width: 200px; height: 18px"
                        />
                    </div>
                </template>
            </Suspense>

            <ButtonGroup>
                <q-btn-dropdown
                    clearable
                    dense
                    outline
                    style="min-width: 220px"
                    :label="'File Types: ' + selectedFileTypes"
                >
                    <q-list style="width: 100%">
                        <q-item
                            v-for="(option, index) in fileTypeFilter"
                            :key="index"
                        >
                            <q-item-section class="items-baseline">
                                <q-toggle
                                    :model-value="fileTypeFilter[index].value"
                                    @click="onFileTypeClicked(index)"
                                    :label="option.name"
                                />
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
                <q-input
                    debounce="300"
                    placeholder="Search"
                    dense
                    v-model="search"
                    outlined
                >
                    <template v-slot:append>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>

                <q-btn
                    flat
                    dense
                    padding="6px"
                    color="icon-secondary"
                    class="button-border"
                    icon="sym_o_loop"
                    @click="() => refresh()"
                >
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>

                <create-file-dialog-opener :mission="mission">
                    <q-btn
                        flat
                        style="height: 100%"
                        class="bg-button-secondary text-on-color"
                        label="Upload File"
                        icon="sym_o_upload"
                    />
                </create-file-dialog-opener>
            </ButtonGroup>
        </div>
        <div class="q-py-lg" v-else style="background: blue">
            <ButtonGroupOverlay>
                <template v-slot:start>
                    <div style="margin: 0; font-size: 14pt; color: white">
                        {{ selectedFiles.length }}
                        {{ selectedFiles.length === 1 ? 'file' : 'files' }}
                        selected
                    </div>
                </template>
                <template v-slot:end>
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        icon="sym_o_move_down"
                        color="white"
                        disable
                    >
                        Move
                    </q-btn>
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        icon="sym_o_download"
                        color="white"
                        @click="() => downloadCallback()"
                    >
                        Download
                    </q-btn>
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        icon="sym_o_delete"
                        color="white"
                        @click="() => deleteFilesCallback()"
                        >Delete</q-btn
                    >
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        icon="sym_o_close"
                        color="white"
                        @click="() => deselect()"
                    />
                </template>
            </ButtonGroupOverlay>
        </div>
        <div>
            <Suspense>
                <ExplorerPageFilesTable
                    :handler="handler"
                    v-model:selected="selectedFiles"
                    v-if="handler"
                />

                <template #fallback>
                    <div style="width: 100%; height: 645px">
                        <q-skeleton
                            class="q-mr-md q-mb-sm q-mt-sm"
                            style="width: 100%; height: 40px"
                        />

                        <div v-for="i in 20" :key="i" class="q-mt-sm">
                            <q-skeleton
                                class="q-mr-md q-mb-sm"
                                style="width: 100%; height: 20px; opacity: 0.5"
                            />
                        </div>
                    </div>
                </template>
            </Suspense>
        </div>
    </div>
</template>

<script setup lang="ts">
import TableHeader from 'components/explorer_page/ExplorerPageTableHeader.vue';
import {
    useHandler,
    useMissionQuery,
    useProjectQuery,
} from 'src/hooks/customQueryHooks';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import ExplorerPageFilesTable from 'components/explorer_page/ExplorerPageFilesTable.vue';
import MoveMissionDialogOpener from 'components/buttons/MoveMissionButton.vue';
import ButtonGroup from 'components/ButtonGroup.vue';
import ROUTES from 'src/router/routes';
import CreateFileDialogOpener from 'components/buttonWrapper/CreateFileDialogOpener.vue';
import DeleteMissionDialogOpener from 'components/buttonWrapper/DeleteMissionDialogOpener.vue';
import { Notify, useQuasar } from 'quasar';
import TitleSection from 'components/TitleSection.vue';
import { useMissionUUID, useProjectUUID } from 'src/hooks/utils';
import { computed, Ref, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { FileType } from 'src/enums/FILE_ENUM';
import { FileEntity } from 'src/types/FileEntity';
import { deleteFiles } from 'src/services/mutations/file';
import ButtonGroupOverlay from 'components/ButtonGroupOverlay.vue';
import ConfirmDeleteDialog from 'src/dialogs/ConfirmDeleteDialog.vue';
import { _downloadFiles } from 'src/services/generic';
import { Tag } from 'src/types/Tag';
import { DataType } from 'src/enums/TAG_TYPES';
import ModifyMissionTagsDialog from 'src/dialogs/ModifyMissionTagsDialog.vue';

const queryClient = useQueryClient();
const handler = useHandler();
const $q = useQuasar();
const $router = useRouter();

const project_uuid = useProjectUUID();
const mission_uuid = useMissionUUID();

const search = computed({
    get: () => handler.value.search_params.name,
    set: (value: string) => {
        handler.value.setSearch({ name: value });
    },
});
const fileTypeFilter = ref([
    { name: 'Bag', value: true },
    { name: 'MCAP', value: true },
]);
const selectedFileTypes = computed(() => {
    return fileTypeFilter.value
        .filter((item) => item.value)
        .map((item) => item.name)
        .join(' & ');
});

const selectedFiles: Ref<FileEntity[]> = ref([]);
watch(
    () => fileTypeFilter.value,
    () => {
        console.log(
            fileTypeFilter.value[0].value && fileTypeFilter.value[1].value,
        );
        if (fileTypeFilter.value[0].value && fileTypeFilter.value[1].value) {
            handler.value.setFileType(FileType.ALL);
            return;
        }
        handler.value.setFileType(
            fileTypeFilter.value[0].value ? FileType.BAG : FileType.MCAP,
        );
    },
    { deep: true },
);

function onFileTypeClicked(index: number) {
    const updatedFileTypeFilter = [...fileTypeFilter.value]; // Only trigger a single mutation
    updatedFileTypeFilter[index].value = !updatedFileTypeFilter[index].value;
    if (!updatedFileTypeFilter[0].value && !updatedFileTypeFilter[1].value) {
        updatedFileTypeFilter[1 - index].value = true;
    }
    fileTypeFilter.value = updatedFileTypeFilter;
}

const { data: project } = useProjectQuery(project_uuid);
const { data: mission } = useMissionQuery(
    mission_uuid,
    (error, query) => {
        Notify.create({
            message: `Error fetching Mission: ${error.response.data.message}`,
            color: 'negative',
            timeout: 2000,
            position: 'bottom',
        });
        handler.value.setMissionUUID(undefined);
        return false;
    },
    200,
);

const { mutate: _deleteFiles } = useMutation({
    mutationFn: (update: { fileUUIDs; missionUUID }) =>
        deleteFiles(update.fileUUIDs, update.missionUUID),
    onSuccess: () => {
        Notify.create({
            message: 'Files deleted successfully',
            color: 'positive',
            timeout: 2000,
            position: 'bottom',
        });
        queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] === 'files' &&
                query.queryKey[1] === mission_uuid.value,
        });
    },
    onError: (error) => {
        Notify.create({
            message: `Error deleting files: ${error.response.data.message}`,
            color: 'negative',
            timeout: 2000,
            position: 'bottom',
        });
    },
});

function refresh() {
    queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'files',
    });
}

function openLink(tag: Tag) {
    if (tag.type.type !== DataType.LINK) return;
    window.open(tag.asString(), '_blank');
}

function deleteFilesCallback() {
    $q.dialog({
        component: ConfirmDeleteDialog,
        componentProps: {
            filenames: selectedFiles.value.map((file) => file.filename),
        },
    }).onOk(() => {
        const fileUUIDs = selectedFiles.value.map((file) => file.uuid);
        _deleteFiles({ fileUUIDs, missionUUID: mission_uuid.value });
    });
}
function deselect() {
    selectedFiles.value = [];
}

async function downloadCallback() {
    await _downloadFiles(selectedFiles.value);
}

function openTagsDialog() {
    $q.dialog({
        component: ModifyMissionTagsDialog,
        componentProps: {
            mission: mission.value,
        },
    });
}
</script>
