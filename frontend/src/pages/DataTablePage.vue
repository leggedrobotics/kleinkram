<template>
    <q-card class="q-pa-md" flat bordered>
        <div class="row q-gutter-sm">
            <div class="col-12 col-md-2">
                <q-btn-dropdown
                    v-model="dd_open"
                    :label="selected_project?.name || 'Filter by Project'"
                    outlined
                    dense
                    clearable
                    class="full-width"
                >
                    <q-list>
                        <q-item
                            v-for="project in projects"
                            :key="project.uuid"
                            clickable
                            @click="
                                selected_project = project;
                                dd_open = false;
                            "
                        >
                            <q-item-section>
                                <q-item-label>{{ project.name }}</q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
            </div>
            <div class="col-12 col-md-2">
                <q-btn-dropdown
                    v-model="dd_open_missions"
                    :label="selected_mission?.name || 'Filter by Mission'"
                    outlined
                    dense
                    clearable
                    class="full-width"
                >
                    <q-list>
                        <q-item
                            v-for="mission in missions"
                            :key="mission.uuid"
                            clickable
                            @click="
                                selected_mission = mission;
                                dd_open_missions = false;
                            "
                        >
                            <q-item-section>
                                <q-item-label>{{ mission.name }}</q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
            </div>

            <div class="col-12 col-md-1">
                <q-input
                    v-model="filter"
                    outlined
                    dense
                    clearable
                    placeholder="Filter by File Name"
                    class="full-width"
                />
            </div>

            <div class="col-12 col-md-3">
                <q-input
                    filled
                    v-model="dateTimeString"
                    dense
                    outlined
                    clearable
                    class="full-width"
                    placeholder="Select Date Range"
                >
                    <template v-slot:prepend>
                        <q-icon name="event" class="cursor-pointer">
                            <q-popup-proxy
                                cover
                                transition-show="scale"
                                transition-hide="scale"
                            >
                                <q-date
                                    v-model="dateTime"
                                    :mask="dateMask"
                                    range
                                >
                                    <div class="row items-center justify-end">
                                        <q-btn
                                            v-close-popup
                                            label="Close"
                                            color="primary"
                                            flat
                                        />
                                    </div>
                                </q-date>
                            </q-popup-proxy>
                        </q-icon>
                    </template>
                </q-input>
            </div>

            <div class="col-12 col-md-3">
                <div class="row">
                    <div class="col-10">
                        <q-select
                            v-model="selectedTopics"
                            label="Select Topics"
                            outlined
                            dense
                            clearable
                            multiple
                            use-chips
                            :options="topics"
                            emit-value
                            map-options
                            class="full-width"
                        />
                    </div>
                    <div class="col-2 flex justify-right">
                        <q-toggle
                            style="padding-left: 5px"
                            v-model="and_or"
                            :label="and_or ? 'And' : 'Or'"
                            dense
                        >
                            <q-tooltip>
                                Toggle between AND/OR conditions for the topics.
                                <br />And: Mission contains all selected topics,
                                Or: Mission contains any of the selected topics
                            </q-tooltip>
                        </q-toggle>

                        <q-toggle
                            style="padding-left: 5px"
                            v-model="mcap_bag"
                            :label="mcap_bag ? 'MCAP' : 'Bag'"
                            dense
                        >
                            <q-tooltip>
                                Display only Bag / MCAP Files.
                            </q-tooltip>
                        </q-toggle>
                    </div>
                </div>
            </div>
        </div>

        <q-separator class="q-ma-md" />
        <QTable
            ref="tableRef"
            v-model:pagination="pagination"
            v-model:selected="selected"
            title="Datasets"
            :rows="data"
            :columns="columns"
            row-key="uuid"
            :loading="loading"
            binary-state-sort
            selection="multiple"
        >
            <template v-slot:body-cell-action="props">
                <q-td :props="props">
                    <q-btn
                        color="primary"
                        label="Edit"
                        @click="() => openQDialog(props.row)"
                    ></q-btn>
                    <q-btn
                        color="primary"
                        label="View"
                        @click="
                            () =>
                                $routerService?.routeTo(ROUTES.FILE, {
                                    uuid: props.row.uuid,
                                })
                        "
                    ></q-btn>
                </q-td>
            </template>
        </QTable>
    </q-card>
</template>
<script setup lang="ts">
import { computed, inject, Ref, ref, watch, watchEffect } from 'vue';
import { debounce, QTable, useQuasar } from 'quasar';
import { useQuery } from '@tanstack/vue-query';

import EditMission from 'components/EditFile.vue';
import { dateMask, formatDate, parseDate } from 'src/services/dateFormating';
import ROUTES from 'src/router/routes';
import RouterService from 'src/services/routerService';
import { formatSize } from 'src/services/generalFormatting';
import { Project } from 'src/types/Project';
import { Mission } from 'src/types/Mission';
import { FileEntity } from 'src/types/FileEntity';
import { allProjects } from 'src/services/queries/project';
import { missionsOfProject } from 'src/services/queries/mission';
import { allTopicsNames } from 'src/services/queries/topic';
import { fetchOverview } from 'src/services/queries/file';
const $routerService: RouterService | undefined = inject('$routerService');

const $q = useQuasar();

const tableRef: Ref<QTable | null> = ref(null);
const loading = ref(false);
const filter = ref('');
const updateFilter = debounce((newFilter) => {
    debouncedFilter.value = newFilter;
}, 500); // Delay of 500ms
watch(filter, () => updateFilter(filter.value));
const debouncedFilter = ref('');
const selected_project: Ref<Project | null> = ref(null);

const dd_open = ref(false);
const projectsReturn = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: allProjects,
});
const projects = projectsReturn.data;

const dd_open_missions = ref(false);
const selected_mission: Ref<Mission | null> = ref(null);

const { data: missions, refetch } = useQuery({
    queryKey: ['missions', selected_project.value?.uuid],
    queryFn: () => missionsOfProject(selected_project.value?.uuid || ''),
    enabled: !!selected_project.value?.uuid,
});

watchEffect(() => {
    if (selected_project.value?.uuid) {
        refetch();
    }
});

const topicsReturn = useQuery<string[]>({
    queryKey: ['topics'],
    queryFn: allTopicsNames,
});
const topics = topicsReturn.data;
const selectedTopics = ref([]);
const and_or = ref(false);
const mcap_bag = ref(true);

const start = new Date(0);
// start.setHours(0, 0, 0, 0);
// start.setMonth(start.getMonth() - 12);
const end = new Date();
end.setHours(23, 59, 59, 999);
const dateTime: Ref<{ from: string; to: string }> = ref({
    from: formatDate(start),
    to: formatDate(end),
});
const dateTimeString = computed({
    get: () => `${dateTime.value.from} - ${dateTime.value.to}`,
    set: (val: string) => {
        const [from, to] = val.split(' - ');
        dateTime.value = { from, to };
    },
});
const startDate = computed(() => parseDate(dateTime.value.from));
const endDate = computed(() => parseDate(dateTime.value.to));

const selected = ref([]);
const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 10,
});

const { isLoading, isError, data, error } = useQuery({
    queryKey: [
        'Filtered Files',
        debouncedFilter,
        selected_project,
        selected_mission,
        startDate,
        endDate,
        selectedTopics,
        and_or,
        mcap_bag,
    ],
    queryFn: () =>
        fetchOverview(
            debouncedFilter.value,
            selected_project.value?.uuid,
            selected_mission.value?.uuid,
            startDate.value,
            endDate.value,
            selectedTopics.value || [],
            and_or.value,
            mcap_bag.value,
        ),
});

const columns = [
    {
        name: 'Project',
        required: true,
        label: 'Project',
        align: 'left',
        field: (row: FileEntity) => row.mission?.project?.name,
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width:  10%; max-width:  10%; min-width: 10%;',
    },
    {
        name: 'Mission',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: FileEntity) => row.mission.name,
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'File',
        required: true,
        label: 'File',
        align: 'left',
        field: (row: FileEntity) => row.filename,
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width:  15%; max-width:  15%; min-width: 15%;',
    },
    {
        name: 'Date',
        required: true,
        label: 'Recoring Date',
        align: 'left',
        field: (row: FileEntity) => row.date,
        format: (val: string) => formatDate(new Date(val)),
        sortable: true,
    },
    {
        name: 'Creation Date',
        required: true,
        label: 'Creation Date',
        align: 'left',
        field: (row: FileEntity) => row.createdAt,
        format: (val: string) => formatDate(new Date(val)),
        sortable: true,
    },
    {
        name: 'Creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: FileEntity) => row.creator.name,
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'Size',
        required: true,
        label: 'Size',
        align: 'left',
        field: (row: FileEntity) => row.size,
        format: formatSize,
        sortable: true,
        sort: (_a: string, _b: string, a: FileEntity, b: FileEntity) =>
            a.size - b.size,
    },
    {
        name: 'action',
        required: true,
        label: 'Edit',
        align: 'center',
        field: 'Edit',
    },
];
/**
 * open a q-dialog with a file editor
 */
function openQDialog(file: FileEntity): void {
    $q.dialog({
        title: 'Profilbild wählen',
        component: EditMission,
        componentProps: {
            file_uuid: file.uuid,
        },
    });
}
</script>
<style scoped></style>
