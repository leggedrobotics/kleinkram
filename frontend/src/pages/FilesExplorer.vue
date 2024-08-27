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
                                <q-chip square color="gray">
                                    {{ tag.type.name }}:
                                    {{ tag.asString() }}
                                </q-chip>
                            </span>
                        </div>
                    </div>

                    <div class="flex column q-mb-auto">
                        <q-btn
                            outline
                            icon="sym_o_edit"
                            label="Edit Mission"
                            disable
                        >
                            <q-tooltip> Edit Mission</q-tooltip>
                        </q-btn>
                    </div>
                </div>
            </div>
        </template>

        <template v-slot:buttons>
            <div>
                <button-group>
                    <q-btn
                        color="primary"
                        outline
                        icon="sym_o_lock"
                        label="Access Rights"
                        disable
                    >
                        <q-tooltip> Manage Access to the Project</q-tooltip>
                    </q-btn>
                    <move-mission-button v-if="mission" :mission="mission" />
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
                    <delete-mission-dialog-opener
                        :mission="mission"
                        v-if="mission"
                    >
                        <q-btn outline color="red" icon="sym_o_delete"></q-btn>
                    </delete-mission-dialog-opener>
                    <q-btn icon="sym_o_more_horiz" outline disabled>
                        <q-tooltip> More Actions</q-tooltip>
                    </q-btn>
                </button-group>
            </div>
        </template>
    </title-section>

    <div>
        <div class="q-my-lg flex justify-between items-center">
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
                            <q-item-section class="items-center">
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

        <div>
            <Suspense>
                <ExplorerPageFilesTable :handler="handler" v-if="handler" />

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
import { useQueryClient } from '@tanstack/vue-query';
import ExplorerPageFilesTable from 'components/explorer_page/ExplorerPageFilesTable.vue';
import MoveMissionButton from 'components/buttons/MoveMissionButton.vue';
import ButtonGroup from 'components/ButtonGroup.vue';
import ROUTES from 'src/router/routes';
import CreateFileDialogOpener from 'components/buttonWrapper/CreateFileDialogOpener.vue';
import DeleteMissionDialogOpener from 'components/buttonWrapper/DeleteMissionDialogOpener.vue';
import { Notify } from 'quasar';
import TitleSection from 'components/TitleSection.vue';
import { useMissionUUID, useProjectUUID } from 'src/hooks/utils';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { FileType } from 'src/enums/FILE_ENUM';

const queryClient = useQueryClient();
const handler = useHandler();

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
    { name: 'Bag', value: false },
    { name: 'MCAP', value: true },
]);
const selectedFileTypes = computed(() => {
    return fileTypeFilter.value
        .filter((item) => item.value)
        .map((item) => item.name)
        .join(' & ');
});
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

function refresh() {
    queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'files',
    });
}
</script>
