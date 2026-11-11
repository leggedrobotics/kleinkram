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
                <q-tab
                    v-if="canCreate"
                    name="users"
                    label="Users"
                    style="color: #222"
                />
                <q-tab
                    name="groups"
                    :label="canCreate ? 'Groups' : 'My Groups'"
                    style="color: #222"
                />
            </q-tabs>
        </template>
    </title-section>

    <div class="q-my-lg">
        <div class="flex justify-between items-center ag-toolbar">
            <button-group class="ag-toolbar__filters">
                <div
                    v-if="tab === 'groups' && prefilterOptions.length > 1"
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

                <CreateAccessGroupDialogOpener
                    v-if="tab === 'groups' && canCreate"
                />
            </button-group>
        </div>

        <q-banner
            v-if="isMine && !canCreate"
            dense
            rounded
            class="q-mt-lg bg-amber-1 text-grey-9"
            style="border: 1px solid #ffe082"
        >
            <template #avatar>
                <q-icon name="sym_o_info" color="grey-8" />
            </template>
            You see the groups you are a member of. To join or leave a group,
            ask one of its <b>group editors</b>. Creating groups requires an
            affiliated account.
        </q-banner>

        <!-- TODO: bulk actions go in the default slot as they arrive -->
        <table-selection-bar
            style="margin-top: 24px"
            :noun="tab === 'groups' ? 'group' : 'user'"
            :count="selectedAccessGroups.length"
            @clear="deselectAccessGroups"
        />

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
            <template #body-cell-Type="props">
                <q-td :props="props">
                    <q-chip
                        dense
                        square
                        size="sm"
                        class="q-ma-none text-weight-medium"
                        :class="typeChipClass(props.row.type)"
                    >
                        {{ typeLabel(props.row.type) }}
                    </q-chip>
                </q-td>
            </template>
            <template #body-cell-YourRole="props">
                <q-td :props="props">
                    <q-chip
                        dense
                        square
                        size="sm"
                        class="q-ma-none text-weight-medium"
                        :color="
                            ownMembership(props.row)?.canEditGroup
                                ? 'grey-10'
                                : 'grey-3'
                        "
                        :text-color="
                            ownMembership(props.row)?.canEditGroup
                                ? 'white'
                                : 'grey-9'
                        "
                    >
                        {{
                            ownMembership(props.row)?.canEditGroup
                                ? 'Editor'
                                : 'Member'
                        }}
                    </q-chip>
                </q-td>
            </template>
            <template #body-cell-Membership="props">
                <q-td :props="props">
                    <span class="row inline items-center no-wrap">
                        <span
                            class="ag-dot"
                            :class="{
                                'ag-dot--expiring': !!ownMembership(props.row)
                                    ?.expirationDate,
                            }"
                        />
                        {{ membershipLabel(props.row) }}
                    </span>
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

                                <template v-if="!isMine">
                                    <q-item v-ripple clickable disabled>
                                        <q-tooltip
                                            v-if="
                                                filterOptions.type ===
                                                AccessGroupType.PRIMARY
                                            "
                                        >
                                            You can't edit personal access
                                            groups
                                        </q-tooltip>
                                        <q-item-section>Edit</q-item-section>
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
                                </template>
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
import ButtonGroup from 'components/buttons/button-group.vue';
import AppRefreshButton from 'components/common/app-refresh-button.vue';
import AppSearchBar from 'components/common/app-search-bar.vue';
import AppStatusChip from 'components/common/app-status-chip.vue';
import TableSelectionBar from 'components/common/table-selection-bar.vue';
import TitleSection from 'components/title-section.vue';
import { QTable, useQuasar } from 'quasar';
import { useRowActivation } from 'src/composables/use-row-activation';
import {
    canCreateProject,
    usePermissionsQuery,
    useUser,
} from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import {
    listMyAccessGroups,
    searchAccessGroups,
} from 'src/services/queries/access';
import { useRoute, useRouter } from 'vue-router';

interface AccessGroupColumn {
    name: string;
    required?: boolean;
    label: string;
    align: string;
    classes?: string;
    headerClasses?: string;
    field?: (row: AccessGroupDto) => string;
    format?: (value: string) => string;
    sortable?: boolean;
    style?: string;
}

const $q = useQuasar();
const $router = useRouter();
const route = useRoute();
const tab = ref((route.query.tab as string) || 'groups');

// Listing all groups needs create rights (CanCreate in the backend). Everyone
// else, e.g. external users, only gets the groups they are a member of.
const { data: permissions } = usePermissionsQuery();
const canCreate = computed(() => canCreateProject(permissions.value));
const currentUser = useUser();

const MINE = 'mine';
type Prefilter = AccessGroupType | typeof MINE;

// the long labels do not fit next to each other on a phone
const prefilterOptions = computed(() => [
    { label: 'My Groups', value: MINE },
    ...(canCreate.value
        ? [
              {
                  label: $q.screen.xs ? 'Custom' : 'Custom Groups',
                  value: AccessGroupType.CUSTOM,
              },
              {
                  label: $q.screen.xs ? 'Affiliation' : 'Affiliation Groups',
                  value: AccessGroupType.AFFILIATION,
              },
          ]
        : []),
]);
const prefilter = ref<Prefilter>(MINE);

const selectedAccessGroups: Ref<ProjectWithMissionsDto[]> = ref([]);

function deselectAccessGroups() {
    selectedAccessGroups.value = [];
}

const filterOptions: Ref<{
    type: AccessGroupType | undefined;
    search: string;
    creator: boolean;
    member: boolean;
}> = ref({
    type: undefined,
    search: '',
    creator: false,
    member: true,
});

const isMine = computed(
    () => tab.value === 'groups' && filterOptions.value.member,
);

// the users tab is not available without create rights
watch(
    () => [canCreate.value, permissions.value] as const,
    ([allowed, loaded]) => {
        if (loaded !== undefined && !allowed && tab.value === 'users') {
            tab.value = 'groups';
        }
    },
);

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

function applyPrefilter(value: Prefilter | undefined) {
    if (!value) return;
    switch (value) {
        case MINE: {
            filterOptions.value.type = undefined;
            filterOptions.value.creator = false;
            filterOptions.value.member = true;

            break;
        }
        case AccessGroupType.CUSTOM: {
            filterOptions.value.type = AccessGroupType.CUSTOM;
            filterOptions.value.creator = false;
            filterOptions.value.member = false;

            break;
        }
        case AccessGroupType.AFFILIATION: {
            filterOptions.value.type = AccessGroupType.AFFILIATION;
            filterOptions.value.creator = true;
            filterOptions.value.member = false;

            break;
        }
        // No default
    }
}

function updatePrefilter(value: string | string[]) {
    if (typeof value === 'string') {
        prefilter.value = value as Prefilter;
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
    queryFn: () => {
        const skip = (pagination.value.page - 1) * pagination.value.rowsPerPage;
        const take = pagination.value.rowsPerPage;
        return isMine.value
            ? listMyAccessGroups(filterOptions.value.search, skip, take)
            : searchAccessGroups(
                  filterOptions.value.search,
                  filterOptions.value.type,
                  skip,
                  take,
              );
    },
    // wait for the permissions so users without create rights never hit the
    // (forbidden) global search
    enabled: computed(() => isMine.value || canCreate.value),
});

function ownMembership(row: AccessGroupDto) {
    return row.memberships.find(
        (membership) => membership.user.uuid === currentUser.data.value?.uuid,
    );
}

function membershipLabel(row: AccessGroupDto): string {
    const expiration = ownMembership(row)?.expirationDate;
    return expiration
        ? `Expires ${formatDate(new Date(expiration))}`
        : 'Permanent';
}

const TYPE_LABELS: Partial<Record<AccessGroupType, string>> = {
    [AccessGroupType.PRIMARY]: 'Primary',
    [AccessGroupType.CUSTOM]: 'Custom',
    [AccessGroupType.AFFILIATION]: 'Affiliation',
};
const typeLabel = (type: AccessGroupType): string => TYPE_LABELS[type] ?? type;
const typeChipClass = (type: AccessGroupType): string =>
    `ag-type--${type.toLowerCase()}`;

const refetchAccessGroup: (event_: Event) => Promise<void> = async () => {
    await refetch();
};

const accessGroupsTable = computed(() =>
    foundAccessGroups.value ? foundAccessGroups.value.data : [],
);

async function openAccessGroup(row: AccessGroupDto): Promise<void> {
    await $router.push({
        name: ROUTES.ACCESS_GROUP.routeName,
        params: { uuid: row.uuid },
    });
}

/**
 * Navigates while nothing is selected, toggles the row once something is.
 * See use-row-activation for why that is safe here.
 */
const { onRowClick: rowClick } = useRowActivation(
    selectedAccessGroups as unknown as Ref<AccessGroupDto[]>,
    openAccessGroup,
);

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
        align: 'right',
        classes: 'kk-num',
        headerClasses: 'kk-num',
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
        align: 'right',
        classes: 'kk-num',
        headerClasses: 'kk-num',
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
        align: 'right',
        classes: 'kk-num',
        headerClasses: 'kk-num',
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

const myGroupsColumns: AccessGroupColumn[] = [
    ...accessGroupsColumns.slice(0, 1),
    {
        name: 'Type',
        label: 'Type',
        align: 'left',
        field: (row: AccessGroupDto): string => row.type,
        sortable: true,
    },
    { name: 'YourRole', label: 'Your Role', align: 'left' },
    { name: 'Membership', label: 'Membership', align: 'left' },
    ...accessGroupsColumns.slice(3),
];

const allColumns = computed(() => {
    if (tab.value === 'users') return usersColumns;
    return isMine.value ? myGroupsColumns : accessGroupsColumns;
});

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
.ag-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
    background: #2e7d32;
}

.ag-dot--expiring {
    background: #ef6c00;
}

.ag-type--primary {
    background: #ede7f6;
    color: #4527a0;
}

.ag-type--custom {
    background: #e3f2fd;
    color: #0d47a1;
}

.ag-type--affiliation {
    background: #e8f5e9;
    color: #1b5e20;
}

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
