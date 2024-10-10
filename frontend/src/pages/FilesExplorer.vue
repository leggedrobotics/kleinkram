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
                                    v-bind:style="[
                                        tag.type.type == 'LINK'
                                            ? { cursor: 'pointer' }
                                            : {},
                                    ]"
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
                    class="button-border"
                    flat
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

                <MissionMetadataOpener :mission="mission" v-if="mission" />

                <q-btn icon="sym_o_more_vert" class="button-border" flat>
                    <q-tooltip> More Actions</q-tooltip>

                    <q-menu auto-close style="width: 320px">
                        <q-list>
                            <klein-download-mission :mission="mission" />
                            <q-separator class="q-ma-sm" />
                            <MoveMissionDialogOpener
                                v-if="mission"
                                :mission="mission"
                            >
                                <q-item clickable v-close-popup>
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_move_down" />
                                    </q-item-section>
                                    <q-item-section>
                                        Move Mission
                                    </q-item-section>
                                </q-item>
                            </MoveMissionDialogOpener>

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

                            <delete-mission-dialog-opener :mission="mission">
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
                <q-select
                    v-model="selectedCategories"
                    v-if="selectedCategories"
                    multiple
                    clearable
                    dense
                    option-label="name"
                    option-value="uuid"
                    :options="categories"
                    placeholder="Select Categories"
                    use-input
                    @clear="selectedCategories = []"
                    input-debounce="300"
                    @input-value="filter = $event"
                >
                    <template v-slot:selected-item="props">
                        <q-chip
                            v-if="props.opt"
                            removable
                            @remove="props.removeAtIndex(props.index)"
                            :color="hashUUIDtoColor(props.opt.uuid)"
                            style="color: white; font-size: smaller"
                        >
                            {{ props.opt.name }}
                        </q-chip>
                    </template>
                    <template v-slot:option="props">
                        <q-item
                            clickable
                            v-ripple
                            v-bind="props.itemProps"
                            @click="props.toggleOption(props.opt)"
                            dense
                        >
                            <q-item-section>
                                <div>
                                    <q-chip
                                        dense
                                        :color="hashUUIDtoColor(props.opt.uuid)"
                                        :style="`color: white `"
                                    >
                                        {{ props.opt.name }}
                                    </q-chip>
                                </div>
                            </q-item-section>
                        </q-item>
                    </template>
                </q-select>
                <q-btn-dropdown
                    clearable
                    dense
                    class="button-border"
                    flat
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
                    <klein-download-files
                        :files="selectedFiles"
                        style="max-width: 300px"
                    />

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
                        >Delete
                    </q-btn>
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        icon="sym_o_close"
                        color="white"
                        @click="deselect"
                    />
                </template>
            </ButtonGroupOverlay>
        </div>
        <div>
            <Suspense>
                <explorer-page-files-table
                    :url_handler="handler"
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
    registerNoPermissionErrorHandler,
    useHandler,
    useMissionQuery,
} from 'src/hooks/customQueryHooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import ExplorerPageFilesTable from 'components/explorer_page/ExplorerPageFilesTable.vue';
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
import { _downloadFiles, hashUUIDtoColor } from 'src/services/generic';
import { Tag } from 'src/types/Tag';
import { DataType } from 'src/enums/TAG_TYPES';
import MissionMetadataOpener from 'components/buttonWrapper/MissionMetadataOpener.vue';
import MoveMissionDialogOpener from 'components/buttonWrapper/MoveMissionDialogOpener.vue';
import KleinDownloadMission from 'components/CLILinks/KleinDownloadMission.vue';
import KleinDownloadFiles from 'components/CLILinks/KleinDownloadFiles.vue';
import { Category } from 'src/types/Category';
import { getCategories } from 'src/services/queries/categories';

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

const filter: Ref<string> = ref('');

const selectedFiles: Ref<FileEntity[]> = ref([]);
watch(
    () => fileTypeFilter.value,
    () => {
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

const {
    data: mission,
    isLoadingError,
    error,
} = useMissionQuery(
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
registerNoPermissionErrorHandler(
    isLoadingError,
    mission_uuid,
    'mission',
    error,
);

const queryKey = computed(() => [
    'categories',
    project_uuid.value,
    filter.value,
]);
const { data: _categories } = useQuery<[Category[], number]>({
    queryKey: queryKey,
    queryFn: () => getCategories(project_uuid.value, filter.value),
});
const categories: Ref<Category[]> = computed(() =>
    _categories.value ? _categories.value[0] : [],
);

const { data: _all_categories } = useQuery<[Category[], number]>({
    queryKey: ['categories', project_uuid.value, ''],
    queryFn: () => getCategories(project_uuid.value, ''),
});
const allCategories: Ref<Category[]> = computed(() =>
    _all_categories.value ? _all_categories.value[0] : [],
);

const selectedCategories: Ref<Category[]> = computed({
    get: () => {
        if (!handler.value.categories) return [];
        return handler.value.categories?.map((catUUID) =>
            allCategories.value?.find((cat) => cat.uuid === catUUID),
        );
    },
    set: (value: Category[]) => {
        if (!value) {
            handler.value.setCategories([]);
            return;
        }
        handler.value.setCategories(value.map((cat) => cat.uuid));
    },
});

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
        deselect();
    });
}

function deselect() {
    selectedFiles.value = [];
}

async function downloadCallback() {
    try {
        await _downloadFiles(selectedFiles.value);
        Notify.create({
            message: 'Files downloaded successfully',
            color: 'positive',
            timeout: 2000,
            position: 'bottom',
        });
    } catch (error) {
        Notify.create({
            message: `Error downloading files: ${error}`,
            color: 'negative',
            timeout: 2000,
            position: 'bottom',
        });
    }
}
</script>
