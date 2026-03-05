<template>
    <title-section title="Access Control">
        <template #tabs>
            <q-tabs
                v-model="tab"
                align="left"
                active-color="primary"
                dense
                class="text-grey"
            >
                <q-tab name="users" label="Users" style="color: #222" />
                <q-tab name="groups" label="Groups" style="color: #222" />
            </q-tabs>
        </template>
    </title-section>

    <div class="q-my-lg">
        <div class="flex justify-between items-center">
            <button-group>
                <div
                    v-if="tab === 'groups'"
                    style="width: 200px"
                    class="self-stretch"
                >
                    <q-btn-dropdown
                        :label="prefilter?.label"
                        class="q-uploader--bordered full-width"
                        style="height: 100%"
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
                                <q-separator v-if="option.spacerAfter" />
                            </template>
                        </q-list>
                    </q-btn-dropdown>
                </div>
            </button-group>

            <button-group>
                <app-search-bar
                    v-model="filterOptions.search"
                    placeholder="Search Users"
                />

                <app-refresh-button @click="refetchAccessGroup" />

                <CreateAccessGroupDialogOpener v-if="tab === 'groups'" />
            </button-group>
        </div>

        <div
            v-if="selectedAccessGroups.length > 0"
            class="q-py-lg"
            style="background: #0f62fe; margin-top: 24px"
        >
            <ButtonGroupOverlay>
                <template #start>
                    <div style="margin: 0; font-size: 14pt; color: white">
                        {{ selectedAccessGroups.length }} items selected
                    </div>
                </template>
                <template #end>
                    <!-- TODO: bulk actions -->
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        icon="sym_o_close"
                        color="white"
                        @click="deselectAccessGroups"
                    />
                </template>
            </ButtonGroupOverlay>
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
            :columns="activeColumns as any"
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
            <template #body-cell-Status="props">
                <q-td :props="props">
                    <app-status-chip
                        :expiration-date="
                            props.row.memberships[0]?.expirationDate
                        "
                    />
                </q-td>
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
                                    @click="
                                        () => rowClick(undefined, props.row)
                                    "
                                >
                                    <q-item-section>
                                        View Details
                                    </q-item-section>
                                </q-item>

                                <q-item v-ripple clickable disabled>
                                    <q-tooltip
                                        v-if="
                                            prefilter?.value ===
                                            AccessGroupType.PRIMARY
                                        "
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

import { formatDate } from 'src/services/date-formating';
import { computed, Ref, ref, watch } from 'vue';

import type { AccessGroupDto } from '@kleinkram/api-dto/types/access-control/access-group.dto';
import type { AccessGroupsDto } from '@kleinkram/api-dto/types/access-control/access-groups.dto';
import type { ProjectWithMissionsDto } from '@kleinkram/api-dto/types/project/project-with-missions.dto';
import { AccessGroupType } from '@kleinkram/shared';
import DeleteAccessGroup from 'components/button-wrapper/delete-access-group.vue';
import CreateAccessGroupDialogOpener from 'components/button-wrapper/dialog-opener-create-access-group.vue';
import ButtonGroupOverlay from 'components/buttons/button-group-overlay.vue';
import ButtonGroup from 'components/buttons/button-group.vue';
import AppRefreshButton from 'components/common/app-refresh-button.vue';
import AppSearchBar from 'components/common/app-search-bar.vue';
import AppStatusChip from 'components/common/app-status-chip.vue';
import TitleSection from 'components/title-section.vue';
import { QTable } from 'quasar';
import ROUTES from 'src/router/routes';
import { searchAccessGroups } from 'src/services/queries/access';
import { useRoute, useRouter } from 'vue-router';

const $router = useRouter();
const route = useRoute();
const tab = ref((route.query.tab as string) || 'groups');

const prefilterOptions = [
    {
        label: 'Custom Groups',
        value: AccessGroupType.CUSTOM,
        spacerAfter: true,
    },
    { label: 'Affiliation Groups', value: AccessGroupType.AFFILIATION },
];
const prefilter = ref(prefilterOptions[0]);

const selectedAccessGroups: Ref<ProjectWithMissionsDto[]> = ref([]);

function deselectAccessGroups() {
    selectedAccessGroups.value = [];
}

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
    () => tab.value,
    (newTab) => {
        void $router.replace({ query: { ...route.query, tab: newTab } });
        if (newTab === 'users') {
            filterOptions.value.type = AccessGroupType.PRIMARY;
            filterOptions.value.creator = false;
            filterOptions.value.member = false;
        } else {
            applyPrefilter(prefilter.value);
        }
    },
    { immediate: true },
);

watch(
    () => prefilter.value,
    (newValue) => {
        if (tab.value === 'groups') {
            applyPrefilter(newValue);
        }
    },
);

function applyPrefilter(
    option: { label: string; value: AccessGroupType } | undefined,
) {
    if (!option) return;
    if (option.value === AccessGroupType.CUSTOM) {
        filterOptions.value.type = AccessGroupType.CUSTOM;
        filterOptions.value.creator = false;
        filterOptions.value.member = false;
    } else if (option.value === AccessGroupType.AFFILIATION) {
        filterOptions.value.type = AccessGroupType.AFFILIATION;
        filterOptions.value.creator = true;
        filterOptions.value.member = false;
    }
}

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

const { data: foundAccessGroups, refetch } = useQuery<AccessGroupsDto>({
    queryKey: accessGroupKey,
    queryFn: () =>
        searchAccessGroups(
            filterOptions.value.search,
            filterOptions.value.type,
            (pagination.value.page - 1) * pagination.value.rowsPerPage,
            pagination.value.rowsPerPage,
        ),
});

const refetchAccessGroup: (event_: Event) => Promise<void> = async () => {
    await refetch();
};

const accessGroupsTable = computed(() =>
    foundAccessGroups.value ? foundAccessGroups.value.data : [],
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rowClick(event: any, row: AccessGroupDto) {
    await $router.push({
        name: ROUTES.ACCESS_GROUP.routeName,
        params: { uuid: row.uuid },
    });
}

const usersColumns = [
    {
        name: 'Name',
        required: true,
        label: 'Name',
        align: 'left',
        field: (row: AccessGroupDto): string => row.name,
        format: (value: string): string => value,
        sortable: true,
        style: 'width:  20%; max-width: 60%; min-width: 10%;',
    },
    {
        name: 'Email',
        required: false,
        label: 'Email',
        align: 'left',
        field: (row: AccessGroupDto): string =>
            row.memberships[0]?.user.email ?? '-',
        format: (value: string): string => value,
        sortable: false,
    },
    {
        name: 'Status',
        required: true,
        label: 'Status',
        align: 'center',
        field: (row: AccessGroupDto): string => {
            const exp = row.memberships[0]?.expirationDate;
            if (exp && new Date(exp) < new Date()) {
                return 'Expired';
            }
            return 'Active';
        },
        format: (value: string): string => value,
        sortable: true,
        style: 'width:  10%; max-width: 10%; min-width: 10%;',
    },
    {
        name: 'Projects',
        required: true,
        label: '# Projects',
        align: 'center',
        field: (row: AccessGroupDto): string =>
            row.projectAccesses.length.toString(),
        format: (value: string): string => value,
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

const accessGroupsColumns = [
    {
        name: 'Access Group',
        required: true,
        label: 'Group Name',
        align: 'left',
        field: (row: AccessGroupDto): string => row.name,
        format: (value: string): string => value,
        sortable: true,
        style: 'width:  20%; max-width: 60%; min-width: 10%;',
    },
    {
        name: 'Creator',
        required: false,
        label: 'Created By',
        align: 'center',
        field: (row: AccessGroupDto): string => row.creator?.name ?? '-',
        format: (value: string): string => value,
        sortable: false,
    },
    {
        name: 'createdAt',
        required: true,
        label: 'Creation Date',
        align: 'center',
        field: (row: AccessGroupDto): string =>
            row.createdAt.toLocaleDateString(),
        format: (value: string): string => formatDate(new Date(value)),
        sortable: true,
        style: 'width:  10%; max-width: 10%; min-width: 10%;',
    },
    {
        name: 'NrOfUsers',
        required: true,
        label: '# Members',
        align: 'center',
        field: (row: AccessGroupDto): string =>
            row.memberships.length.toString(),
        format: (value: string): string => value,
        sortable: true,
        style: 'width:  10%; max-width: 10%; min-width: 5%;',
    },
    {
        name: 'NrOfProjects',
        required: true,
        label: '# Projects',
        align: 'center',
        field: (row: AccessGroupDto): string =>
            row.projectAccesses.length.toString(),
        format: (value: string): string => value,
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

const activeColumns = computed(() => {
    return tab.value === 'users' ? usersColumns : accessGroupsColumns;
});
</script>

<style scoped></style>
