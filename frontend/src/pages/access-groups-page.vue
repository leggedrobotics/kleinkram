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
        <div class="flex justify-between items-center ag-toolbar">
            <button-group class="ag-toolbar__filters">
                <div
                    v-if="tab === 'groups'"
                    class="self-stretch flex items-center scroll-x-nowrap"
                >
                    <q-btn-toggle
                        v-model="prefilter"
                        :options="prefilterOptions"
                        unelevated
                        no-caps
                        toggle-color="grey-10"
                        toggle-text-color="white"
                        color="white"
                        text-color="grey-7"
                        style="border: 1px solid #e0e0e0; border-radius: 4px"
                        @update:model-value="updatePrefilter"
                    />
                </div>
            </button-group>

            <button-group class="ag-toolbar__actions">
                <app-search-bar
                    v-model="filterOptions.search"
                    class="ag-toolbar__search"
                    :placeholder="
                        tab === 'groups' ? 'Search Groups' : 'Search Users'
                    "
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
            :virtual-scroll="!$q.screen.xs"
            :grid="$q.screen.xs"
            separator="none"
            :rows="accessGroupsTable"
            :columns="activeColumns as any"
            style="margin-top: 24px"
            selection="multiple"
            row-key="uuid"
            @row-click="rowClick"
        >
            <!-- phones: the table header is replaced by an explicit sort menu -->
            <template v-if="$q.screen.xs" #top>
                <q-btn
                    flat
                    dense
                    no-caps
                    class="button-border q-px-sm"
                    icon="sym_o_swap_vert"
                    :label="sortLabel"
                    aria-label="Change sorting"
                >
                    <q-menu auto-close>
                        <q-list>
                            <q-item
                                v-for="column in sortableColumns"
                                :key="column.name"
                                v-ripple
                                clickable
                                @click="() => setSort(column.name)"
                            >
                                <q-item-section>
                                    {{ column.label }}
                                </q-item-section>
                                <q-item-section
                                    v-if="pagination.sortBy === column.name"
                                    side
                                >
                                    <q-icon
                                        :name="
                                            pagination.descending
                                                ? 'sym_o_arrow_downward'
                                                : 'sym_o_arrow_upward'
                                        "
                                        size="18px"
                                    />
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-btn>
            </template>

            <!-- phones: one tappable card per access group -->
            <template v-if="$q.screen.xs" #item="props">
                <div class="col-12 q-pa-xs">
                    <q-card
                        flat
                        bordered
                        class="ag-card"
                        :class="{ 'ag-card--selected': props.selected }"
                        @click="() => rowClick(undefined, props.row)"
                    >
                        <q-card-section class="q-px-md q-py-sm">
                            <div class="row items-center no-wrap">
                                <q-checkbox
                                    v-model="props.selected"
                                    color="grey-8"
                                    dense
                                    class="q-mr-md"
                                    aria-label="Select access group"
                                    @click.stop
                                />
                                <div class="col column" style="min-width: 0">
                                    <div class="text-weight-medium ellipsis">
                                        {{ props.row.name }}
                                    </div>
                                    <!-- The search endpoint does not expose user
                                         emails, so personal groups show no caption -->
                                    <div
                                        v-if="tab !== 'users'"
                                        class="text-caption text-grey-7 ellipsis"
                                    >
                                        {{ props.row.creator?.name ?? '-' }}
                                        &middot;
                                        {{
                                            formatDate(
                                                new Date(props.row.createdAt),
                                            )
                                        }}
                                    </div>
                                </div>
                                <q-btn
                                    flat
                                    round
                                    dense
                                    icon="sym_o_more_vert"
                                    unelevated
                                    color="primary"
                                    class="cursor-pointer"
                                    aria-label="Access group actions"
                                    @click.stop
                                >
                                    <q-menu auto-close>
                                        <q-list>
                                            <q-item
                                                v-ripple
                                                clickable
                                                @click="
                                                    () =>
                                                        rowClick(
                                                            undefined,
                                                            props.row,
                                                        )
                                                "
                                            >
                                                <q-item-section>
                                                    View Details
                                                </q-item-section>
                                            </q-item>
                                            <q-item v-ripple clickable disabled>
                                                <q-item-section>
                                                    Edit
                                                </q-item-section>
                                            </q-item>
                                            <DeleteAccessGroup
                                                :access-group="props.row"
                                            >
                                                <q-item v-ripple clickable>
                                                    <q-item-section>
                                                        Delete
                                                    </q-item-section>
                                                </q-item>
                                            </DeleteAccessGroup>
                                        </q-list>
                                    </q-menu>
                                </q-btn>
                            </div>
                            <div class="row items-center q-gutter-x-sm q-mt-sm">
                                <app-status-chip
                                    v-if="tab === 'users'"
                                    :expiration-date="
                                        props.row.memberships[0]?.expirationDate
                                    "
                                />
                                <q-chip
                                    v-else
                                    dense
                                    square
                                    size="sm"
                                    color="grey-2"
                                    text-color="grey-9"
                                    class="q-ma-none"
                                >
                                    {{ props.row.memberships.length }} members
                                </q-chip>
                                <q-chip
                                    dense
                                    square
                                    size="sm"
                                    color="grey-2"
                                    text-color="grey-9"
                                    class="q-ma-none"
                                >
                                    {{ props.row.projectAccesses.length }}
                                    projects
                                </q-chip>
                            </div>
                        </q-card-section>
                    </q-card>
                </div>
            </template>

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
                                            filterOptions.type ===
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

import { formatDate, isExpired } from 'src/services/date-formating';
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
import { QTable, useQuasar } from 'quasar';
import ROUTES from 'src/router/routes';
import { searchAccessGroups } from 'src/services/queries/access';
import { useRoute, useRouter } from 'vue-router';

interface AccessGroupColumn {
    name: string;
    required?: boolean;
    label: string;
    align: string;
    field?: (row: AccessGroupDto) => string;
    format?: (value: string) => string;
    sortable?: boolean;
    style?: string;
}

const $q = useQuasar();
const $router = useRouter();
const route = useRoute();
const tab = ref((route.query.tab as string) || 'groups');

// the long labels do not fit next to each other on a phone
const prefilterOptions = computed(() => [
    {
        label: $q.screen.xs ? 'Custom' : 'Custom Groups',
        value: AccessGroupType.CUSTOM,
    },
    {
        label: $q.screen.xs ? 'Affiliation' : 'Affiliation Groups',
        value: AccessGroupType.AFFILIATION,
    },
]);
const prefilter = ref<AccessGroupType>(AccessGroupType.CUSTOM);

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
        selectedAccessGroups.value = [];
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

function applyPrefilter(value: AccessGroupType | undefined) {
    if (!value) return;
    if (value === AccessGroupType.CUSTOM) {
        filterOptions.value.type = AccessGroupType.CUSTOM;
        filterOptions.value.creator = false;
        filterOptions.value.member = false;
    } else if (value === AccessGroupType.AFFILIATION) {
        filterOptions.value.type = AccessGroupType.AFFILIATION;
        filterOptions.value.creator = true;
        filterOptions.value.member = false;
    }
}

function updatePrefilter(value: string | string[]) {
    if (typeof value === 'string') {
        prefilter.value = value as AccessGroupType;
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

const usersColumns: AccessGroupColumn[] = [
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
            if (isExpired(exp)) {
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

const accessGroupsColumns: AccessGroupColumn[] = [
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

const allColumns = computed(() =>
    tab.value === 'users' ? usersColumns : accessGroupsColumns,
);

// secondary columns are dropped on tablet-sized screens, on phones the table
// is replaced by a card list and the columns are only used for sorting
const secondaryColumns = computed(() =>
    tab.value === 'users'
        ? new Set(['Projects'])
        : new Set(['Creator', 'createdAt']),
);

const activeColumns = computed(() =>
    $q.screen.sm
        ? allColumns.value.filter(
              (column) => !secondaryColumns.value.has(column.name),
          )
        : allColumns.value,
);

const sortableColumns = computed(() =>
    allColumns.value.filter((column) => column.sortable),
);

const sortLabel = computed(
    () =>
        sortableColumns.value.find(
            (column) => column.name === pagination.value.sortBy,
        )?.label ?? 'Sort',
);

const setSort = (columnName: string): void => {
    if (pagination.value.sortBy === columnName) {
        pagination.value.descending = !pagination.value.descending;
    } else {
        pagination.value.sortBy = columnName;
        pagination.value.descending = false;
    }
};
</script>

<style scoped>
.button-border {
    border: 1px solid #e0e0e0;
    border-radius: 4px;
}

.ag-card--selected {
    background-color: #e7efff;
}

/* below 1024px the toolbar stacks: search on its own row, buttons below */
@media (max-width: 1023px) {
    .ag-toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
    }

    .ag-toolbar__actions {
        order: -1;
        flex-wrap: wrap;
    }

    .ag-toolbar__search {
        flex: 1 0 100%;
    }

    .ag-toolbar :deep(.q-btn) {
        min-height: 40px;
        min-width: 40px;
    }
}
</style>
