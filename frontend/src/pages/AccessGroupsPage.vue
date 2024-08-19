<template>
    <q-page>
        <div class="q-pa-md">
            <div class="text-h4">Access Groups</div>
            <div
                class="row"
                style="
                    padding-left: 0;
                    margin-bottom: 30px;
                    align-items: center;
                    height: 40px;
                "
            >
                <div class="col-2 q-pa-md">
                    <q-btn-dropdown
                        :label="prefilter.label"
                        class="q-uploader--bordered full-width full-height"
                        flat
                    >
                        <q-list>
                            <q-item
                                v-for="option in prefilterOptions"
                                :key="option.value"
                                clickable
                                v-ripple
                                @click="() => (prefilter = option)"
                            >
                                <q-item-section>{{
                                    option.label
                                }}</q-item-section>
                            </q-item>
                        </q-list>
                    </q-btn-dropdown>
                </div>
                <div class="col-6 q-pa-md" />
                <div class="col-4">
                    <div class="row items-center">
                        <q-input
                            v-model="filterOptions.search"
                            label="Search"
                            outlined
                            class="q-mr-sm full-height"
                            style="width: 45%"
                            debounce="200"
                            dense
                        >
                            <template v-slot:append>
                                <q-icon name="sym_o_search" />
                            </template>
                        </q-input>

                        <q-btn
                            icon="sym_o_loop"
                            class="q-mr-sm full-height"
                            @click="() => refetchAccessGroups()"
                        />

                        <q-btn
                            label="Create Access Group"
                            color="dark"
                            icon="sym_o_add"
                            style="width: 45%"
                            class="full-height"
                        />
                    </div>
                </div>
            </div>
            <q-table
                :rows="accessGroupsTable"
                v-model:pagination="pagination"
                title="Access Groups"
                :columns="accessGroupsColumns"
                style="margin-top: 8px"
                selection="multiple"
                v-model:selected="selectedAccessGroups"
                row-key="uuid"
                @rowClick="rowClick"
            >
                <template v-slot:body-cell-accessgroupaction="props">
                    <q-td :props="props">
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_more_vert"
                            unelevated
                            color="primary"
                            class="cursor-pointer"
                            @click.stop
                        >
                            <q-menu auto-close>
                                <q-list>
                                    <q-item
                                        clickable
                                        v-ripple
                                        @click="rowClick(undefined, props.row)"
                                    >
                                        <q-item-section
                                            >View Details
                                        </q-item-section>
                                    </q-item>

                                    <q-item clickable v-ripple disabled>
                                        <q-item-section>Edit </q-item-section>
                                    </q-item>
                                    <q-item clickable v-ripple disabled>
                                        <q-item-section>Delete </q-item-section>
                                    </q-item>
                                </q-list>
                            </q-menu>
                        </q-btn>
                    </q-td>
                </template>
            </q-table>
        </div>
    </q-page>
</template>
<script setup lang="ts">
import { useMutation, useQuery } from '@tanstack/vue-query';

import { computed, inject, Ref, ref, watch } from 'vue';
import { formatDate } from 'src/services/dateFormating';
import { Project } from 'src/types/Project';

import { AccessGroup } from 'src/types/AccessGroup';
import { searchAccessGroups } from 'src/services/queries/access';
import ROUTES from 'src/router/routes';
import { useRouter } from 'vue-router';
import RouterService from 'src/services/routerService';

const $router = useRouter();
const $routerService = inject<RouterService>('$routerService');
const prefilter = ref({ label: 'All', value: 'all' });
const prefilterOptions = [
    { label: 'All', value: 'all' },
    { label: 'Member', value: 'member' },
    { label: 'Created', value: 'created' },
    { label: 'Personal', value: 'personal' },
];

const selectedAccessGroups: Ref<Project[]> = ref([]);

const filterOptions: Ref<{
    personal: boolean;
    search: string;
    creator: boolean;
    member: boolean;
}> = ref({
    personal: false,
    search: '',
    creator: false,
    member: false,
});

watch(
    () => prefilter.value,
    (newVal) => {
        if (newVal.value === 'all') {
            filterOptions.value.personal = false;
            filterOptions.value.creator = false;
            filterOptions.value.member = false;
        } else if (newVal.value === 'member') {
            filterOptions.value.member = true;
            filterOptions.value.creator = false;
            filterOptions.value.personal = false;
        } else if (newVal.value === 'created') {
            filterOptions.value.creator = true;
            filterOptions.value.member = false;
            filterOptions.value.personal = false;
        } else if (newVal.value === 'personal') {
            filterOptions.value.personal = true;
            filterOptions.value.creator = false;
            filterOptions.value.member = false;
        }
    },
);

const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 30,
});
const accessGroupKey = computed(() => [
    'accessGroups',
    filterOptions.value,
    pagination.value,
]);

const { data: foundAccessGroups, refetch: refetchAccessGroups } = useQuery<
    [AccessGroup[], number]
>({
    queryKey: accessGroupKey,
    queryFn: () =>
        searchAccessGroups(
            filterOptions.value.search,
            filterOptions.value.personal,
            filterOptions.value.creator,
            filterOptions.value.member,
            (pagination.value.page - 1) * pagination.value.rowsPerPage,
            pagination.value.rowsPerPage,
        ),
});
const accessGroupsTable = computed(() =>
    foundAccessGroups.value ? foundAccessGroups.value[0] : [],
);

async function rowClick(event: any, row: AccessGroup) {
    await $router.push({
        name: 'AccessGroupDetailPage',
        params: { uuid: row.uuid },
    });
}

const accessGroupsColumns = [
    {
        name: 'Access Group',
        required: true,
        label: 'Access Group',
        align: 'left',
        field: (row: AccessGroup) => row.name,
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width:  60%; max-width: 60%; min-width: 10%;',
    },
    {
        name: 'NrOfUsers',
        required: true,
        label: 'Nr of Users',
        align: 'center',
        field: (row: AccessGroup) => row.users.length,
        format: (val: number) => `${val}`,
        sortable: true,
        style: 'width:  5%; max-width: 10%; min-width: 5%;',
    },
    {
        name: 'NrOfProjects',
        required: true,
        label: 'Nr of Projects',
        align: 'center',
        field: (row: AccessGroup) =>
            row.project_accesses.map((pa) => pa.project).flat().length,
        format: (val: number) => `${val}`,
        sortable: true,
        style: 'width:  5%; max-width: 10%; min-width: 5%;',
    },
    {
        name: 'Creator',
        required: false,
        label: 'Creator',
        align: 'center',
        field: (row: AccessGroup) => row.creator?.name,
        format: (val: string) => `${val}`,
        sortable: false,
        style: 'width:  20%; max-width: 30%; min-width: 10%;',
    },
    {
        name: 'createdAt',
        required: true,
        label: 'Creation Date',
        align: 'center',
        field: (row: AccessGroup) => row.createdAt,
        format: (val: string) => formatDate(new Date(val)),
        sortable: true,
        style: 'width:  10%; max-width: 10%; min-width: 10%;',
    },
    {
        name: 'accessgroupaction',
        label: ' ',
        align: 'center',
        style: 'width:  2%; max-width: 10%; min-width: 2%;',
    },
];
</script>

<style scoped></style>
