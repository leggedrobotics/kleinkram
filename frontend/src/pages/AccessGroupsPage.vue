<template>
    <title-section title="Access Groups" />

    <div class="q-my-lg">
        <div class="flex justify-between items-center">
            <button-group>
                <div style="width: 200px">
                    <q-btn-dropdown
                        :label="prefilter.label"
                        class="q-uploader--bordered full-width full-height"
                        flat
                        auto-close
                    >
                        <q-list>
                            <template
                                v-for="option in prefilterOptions"
                                :key="option.value"
                            >
                                <q-item
                                    v-ripple
                                    clickable
                                    @click="() => (prefilter = option)"
                                >
                                    <q-item-section>
                                        {{ option.label }}
                                    </q-item-section>
                                </q-item>
                                <q-separator v-if="option.spacer_after" />
                            </template>
                        </q-list>
                    </q-btn-dropdown>
                </div>
            </button-group>

            <button-group>
                <q-input
                    v-model="filterOptions.search"
                    dense
                    outlined
                    placeholder="Search"
                    debounce="200"
                >
                    <template #append>
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
                    @click="() => refetchAccessGroups()"
                />

                <CreateAccessGroupDialogOpener />
            </button-group>
        </div>

        <q-table
            v-model:pagination="pagination"
            v-model:selected="selectedAccessGroups"
            flat
            bordered
            wrap-cells
            virtual-scroll
            separator="none"
            :rows="accessGroupsTable"
            :columns="accessGroupsColumns as any"
            style="margin-top: 24px"
            selection="multiple"
            row-key="uuid"
            @row-click="rowClick"
        >
            <template #body-selection="props">
                <q-checkbox
                    v-model="props.selected"
                    color="grey-8"
                    class="checkbox-with-hitbox"
                />
            </template>
            <template #body-cell-accessgroupaction="props">
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
                                    v-ripple
                                    clickable
                                    @click="rowClick(undefined, props.row)"
                                >
                                    <q-item-section>
                                        View Details
                                    </q-item-section>
                                </q-item>

                                <q-item v-ripple clickable disabled>
                                    <q-tooltip
                                        v-if="prefilter.value === 'personal'"
                                    >
                                        You can't edit personal access groups
                                    </q-tooltip>
                                    <q-item-section>Edit</q-item-section>
                                </q-item>
                                <DeleteAccessGroup :access-group="props.row">
                                    <q-item v-ripple clickable>
                                        <q-item-section>Delete</q-item-section>
                                    </q-item>
                                </DeleteAccessGroup>
                            </q-list>
                        </q-menu>
                    </q-btn>
                </q-td>
            </template>
        </q-table>
    </div>
</template>
<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';

import { computed, Ref, ref, watch } from 'vue';
import { formatDate } from 'src/services/dateFormating';

import { searchAccessGroups } from 'src/services/queries/access';
import { useRouter } from 'vue-router';
import ROUTES from 'src/router/routes';
import TitleSection from 'components/TitleSection.vue';
import { QTable } from 'quasar';
import ButtonGroup from 'components/ButtonGroup.vue';
import DeleteAccessGroup from 'components/buttonWrapper/DeleteAccessGroup.vue';
import CreateAccessGroupDialogOpener from 'components/buttonWrapper/CreateAccessGroupDialogOpener.vue';
import { AccessGroupType } from '@common/enum';

const $router = useRouter();
const prefilterOptions = [
    { label: 'All Groups', value: 'all' },
    { label: 'Member Of', value: 'member' },
    { label: 'Groups Created', value: 'created', spacer_after: true },
    { label: 'All Users', value: 'personal' },
];
const prefilter = ref(prefilterOptions[0]);

const selectedAccessGroups: Ref<Project[]> = ref([]);

const filterOptions: Ref<{
    type: AccessGroupType;
    search: string;
    creator: boolean;
    member: boolean;
}> = ref({
    type: AccessGroupType.CUSTOM,
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
        name: ROUTES.ACCESS_GROUP.routeName,
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
        format: (val: string) => val,
        sortable: true,
        style: 'width:  20%; max-width: 60%; min-width: 10%;',
    },
    {
        name: 'Creator',
        required: false,
        label: 'Group Creator',
        align: 'center',
        field: (row: AccessGroup) => row.creator?.name || '-',
        format: (val: string) => val,
        sortable: false,
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
        name: 'NrOfUsers',
        required: true,
        label: 'Nr of Users',
        align: 'center',
        field: (row: AccessGroup) => row.memberships.length,
        format: (val: number) => `${val}`,
        sortable: true,
        style: 'width:  10%; max-width: 10%; min-width: 5%;',
    },
    {
        name: 'NrOfProjects',
        required: true,
        label: 'Nr of Projects',
        align: 'center',
        field: (row: AccessGroup) =>
            row.projectAccesses.map((pa) => pa.project).flat().length,
        format: (val: number) => `${val}`,
        sortable: true,
        style: 'width:  10%; max-width: 10%; min-width: 5%;',
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
