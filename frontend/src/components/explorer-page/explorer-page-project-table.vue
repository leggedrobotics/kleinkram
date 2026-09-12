<template>
    <q-table
        v-if="!isLoading"
        v-model:pagination="pagination"
        v-model:selected="selected"
        flat
        :bordered="!isPhone"
        :grid="isPhone"
        :rows-per-page-options="[10, 20, 50, 100]"
        :rows="data"
        :columns="tableColumns as any"
        :visible-columns="visibleColumns"
        row-key="uuid"
        :loading="isLoading"
        wrap-cells
        :virtual-scroll="!isPhone"
        separator="none"
        selection="multiple"
        binary-state-sort
        @row-click="onRowClick"
        @request="setPagination"
    >
        <template #body-selection="props">
            <q-checkbox
                v-model="props.selected"
                color="grey-8"
                class="checkbox-with-hitbox"
            />
        </template>
        <template #loading>
            <q-inner-loading showing color="primary" />
        </template>

        <!-- Sorting is done through the column headers on wider screens; the
             card layout has no headers, so it gets an explicit sort menu. -->
        <template v-if="isPhone" #top>
            <div class="row items-center full-width" style="gap: 8px">
                <q-btn-dropdown
                    flat
                    dense
                    no-caps
                    class="button-border q-px-sm"
                    :label="`Sort: ${currentSortLabel}`"
                    aria-label="Sort projects"
                >
                    <q-list>
                        <q-item
                            v-for="option in sortOptions"
                            :key="option.value"
                            v-close-popup
                            clickable
                            @click="() => applySort(option.value)"
                        >
                            <q-item-section>{{ option.label }}</q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>

                <q-btn
                    flat
                    dense
                    class="button-border"
                    style="min-width: 40px; min-height: 40px"
                    :icon="
                        descending
                            ? 'sym_o_arrow_downward'
                            : 'sym_o_arrow_upward'
                    "
                    :aria-label="
                        descending
                            ? 'Sort ascending instead'
                            : 'Sort descending instead'
                    "
                    @click="toggleSortDirection"
                >
                    <q-tooltip>
                        {{ descending ? 'Descending' : 'Ascending' }}
                    </q-tooltip>
                </q-btn>
            </div>
        </template>

        <template #no-data>
            <div
                class="flex flex-center"
                style="justify-content: center; margin: auto"
            >
                <div
                    class="q-pa-md flex flex-center column q-gutter-md"
                    style="min-height: 200px"
                >
                    <span class="text-subtitle1"> No Projects Found </span>

                    <dialog-opener-create-project>
                        <q-btn
                            flat
                            dense
                            padding="6px"
                            class="button-border"
                            label="Create Project"
                            icon="sym_o_add"
                        />
                    </dialog-opener-create-project>
                </div>
            </div>
        </template>

        <!-- Phone layout: one tappable card per project -->
        <template #item="props">
            <div class="col-12 q-pb-sm">
                <q-card
                    flat
                    bordered
                    class="project-card"
                    :class="{ 'project-card--selected': props.selected }"
                >
                    <div class="row no-wrap items-start q-pa-sm">
                        <q-checkbox
                            v-model="props.selected"
                            dense
                            color="grey-8"
                            class="q-mr-sm"
                            aria-label="Select project"
                        />

                        <div
                            class="col cursor-pointer"
                            style="min-width: 0"
                            @click="(event) => onRowClick(event, props.row)"
                        >
                            <div
                                class="text-subtitle2 project-card__text ellipsis-2-lines"
                            >
                                {{ props.row.name }}
                            </div>
                            <div
                                v-if="props.row.description"
                                class="text-caption text-grey-8 project-card__text ellipsis-2-lines"
                            >
                                {{ props.row.description }}
                            </div>
                            <div class="text-caption text-grey-7 q-mt-xs">
                                {{ props.row.missionCount }}
                                {{
                                    props.row.missionCount === 1
                                        ? 'mission'
                                        : 'missions'
                                }}
                                &middot; {{ formatSize(props.row.size) }}
                            </div>
                            <div class="text-caption text-grey-7">
                                {{ props.row.creator.name }} &middot;
                                {{ formatDate(new Date(props.row.createdAt)) }}
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
                            aria-label="Project actions"
                            @click.stop
                        >
                            <q-menu auto-close>
                                <q-list>
                                    <q-item
                                        v-ripple
                                        clickable
                                        @click="
                                            (event) =>
                                                onRowClick(event, props.row)
                                        "
                                    >
                                        <q-item-section>
                                            View Missions
                                        </q-item-section>
                                    </q-item>
                                    <EditProjectDialogOpener
                                        :project-uuid="props.row.uuid"
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Edit Project
                                            </q-item-section>
                                        </q-item>
                                    </EditProjectDialogOpener>
                                    <ConfigureTagsDialogOpener
                                        :project-uuid="props.row.uuid"
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Enforce Metadata
                                            </q-item-section>
                                        </q-item>
                                    </ConfigureTagsDialogOpener>
                                    <change-project-rights-dialog-opener
                                        :project-uuid="props.row.uuid"
                                        :project-access-uuid="
                                            props.row.project_access_uuid ?? ''
                                        "
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Manage Access
                                            </q-item-section>
                                        </q-item>
                                    </change-project-rights-dialog-opener>
                                    <DeleteProjectDialogOpener
                                        :project-uuid="props.row.uuid"
                                        :has-missions="
                                            props.row.missionCount > 0
                                        "
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Delete
                                            </q-item-section>
                                        </q-item>
                                    </DeleteProjectDialogOpener>
                                </q-list>
                            </q-menu>
                        </q-btn>
                    </div>
                </q-card>
            </div>
        </template>

        <template #body-cell-project-action="props">
            <Suspense>
                <q-td :props="props">
                    <q-btn
                        flat
                        round
                        dense
                        icon="sym_o_more_vert"
                        unelevated
                        color="primary"
                        class="cursor-pointer"
                        aria-label="Project actions"
                        @click.stop
                    >
                        <q-menu auto-close>
                            <q-list>
                                <q-item
                                    v-ripple
                                    clickable
                                    @click="
                                        (event) => onRowClick(event, props.row)
                                    "
                                >
                                    <q-item-section>
                                        View Missions
                                    </q-item-section>
                                </q-item>
                                <EditProjectDialogOpener
                                    :project-uuid="props.row.uuid"
                                >
                                    <q-item v-ripple clickable>
                                        <q-item-section>
                                            Edit Project
                                        </q-item-section>
                                    </q-item>
                                </EditProjectDialogOpener>
                                <ConfigureTagsDialogOpener
                                    :project-uuid="props.row.uuid"
                                >
                                    <q-item v-ripple clickable>
                                        <q-item-section>
                                            Enforce Metadata
                                        </q-item-section>
                                    </q-item>
                                </ConfigureTagsDialogOpener>

                                <change-project-rights-dialog-opener
                                    :project-uuid="props.row.uuid"
                                    :project-access-uuid="
                                        props.row.project_access_uuid ?? ''
                                    "
                                >
                                    <q-item v-ripple clickable>
                                        <q-item-section>
                                            Manage Access
                                        </q-item-section>
                                    </q-item>
                                </change-project-rights-dialog-opener>
                                <DeleteProjectDialogOpener
                                    :project-uuid="props.row.uuid"
                                    :has-missions="props.row.missionCount > 0"
                                >
                                    <q-item v-ripple clickable>
                                        <q-item-section>Delete</q-item-section>
                                    </q-item>
                                </DeleteProjectDialogOpener>
                            </q-list>
                        </q-menu>
                    </q-btn>
                </q-td>
            </Suspense>
        </template>
    </q-table>
</template>

<script setup lang="ts">
import DeleteProjectDialogOpener from 'components/button-wrapper/delete-project-dialog-opener.vue';
import ChangeProjectRightsDialogOpener from 'components/button-wrapper/dialog-opener-change-project-rights.vue';
import ConfigureTagsDialogOpener from 'components/button-wrapper/dialog-opener-configure-tags.vue';
import DialogOpenerCreateProject from 'components/button-wrapper/dialog-opener-create-project.vue';
import EditProjectDialogOpener from 'components/button-wrapper/edit-project-dialog-opener.vue';
import { QTable, useQuasar } from 'quasar';
import { explorerPageTableColumns } from 'src/components/explorer-page/explorer-page-table-columns';
import {
    useFilteredProjects,
    useHandler,
    useUser,
} from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { formatDate } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import { TableRequest } from 'src/services/query-handler';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const urlHandler = useHandler();
const $q = useQuasar();

const { myProjects } = defineProps<{ myProjects: boolean }>();
const { data: user } = useUser();

/**
 * Phones get a card list instead of a table, tablets keep the table but only
 * show the columns that fit without horizontal scrolling.
 */
const isPhone = computed(() => $q.screen.xs);
const isCompact = computed(() => $q.screen.lt.md);

const tableColumns = computed(() =>
    isCompact.value
        ? // `required` columns cannot be hidden by `visible-columns`
          explorerPageTableColumns.map((column) => ({
              ...column,
              required: false,
          }))
        : explorerPageTableColumns,
);

const visibleColumns = computed(() =>
    isCompact.value
        ? ['name', 'description', 'nrOfMissions', 'project-action']
        : undefined,
);

const sortOptions = explorerPageTableColumns
    .filter((column) => column.sortable === true)
    .map((column) => ({ label: column.label, value: column.name }));

const descending = computed(() => urlHandler.value.descending);

const currentSortLabel = computed(
    () =>
        sortOptions.find((option) => option.value === urlHandler.value.sortBy)
            ?.label ?? 'Name',
);

async function setPagination(update: TableRequest): Promise<void> {
    urlHandler.value.setPage(update.pagination.page);
    urlHandler.value.setTake(update.pagination.rowsPerPage);
    urlHandler.value.setSort(update.pagination.sortBy);
    urlHandler.value.setDescending(update.pagination.descending);
    await refetch();
}

async function applySort(sortBy: string): Promise<void> {
    urlHandler.value.setSort(sortBy);
    await refetch();
}

async function toggleSortDirection(): Promise<void> {
    urlHandler.value.setDescending(!urlHandler.value.descending);
    await refetch();
}

const pagination = computed({
    get: () => ({
        page: urlHandler.value.page,
        rowsPerPage: urlHandler.value.take,
        rowsNumber: urlHandler.value.rowsNumber,
        sortBy: urlHandler.value.sortBy,
        descending: urlHandler.value.descending,
    }),
    set: (value) => ({
        page: value.page,
        rowsPerPage: value.rowsPerPage,
        sortBy: value.sortBy,
        descending: value.descending,
    }),
});

const selected = ref([]);

const {
    data: rawData,
    isLoading,
    refetch,
} = useFilteredProjects(
    computed(() => urlHandler.value.take),
    computed(() => urlHandler.value.skip),
    computed(() => urlHandler.value.sortBy),
    computed(() => urlHandler.value.descending),
    computed(() => ({
        ...urlHandler.value.searchParams,
        ...(myProjects
            ? // eslint-disable-next-line @typescript-eslint/naming-convention
              { 'creator.uuid': user.value?.uuid ?? '' }
            : {}),
    })),
);

const data = computed(() => (rawData.value ? rawData.value.data : []));
const total = computed(() => (rawData.value ? rawData.value.count : 0));

watch(
    () => total.value,
    () => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (data.value && !isLoading.value) {
            urlHandler.value.rowsNumber = total.value;
        }
    },
    { immediate: true },
);

const $router = useRouter();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onRowClick = async (_: Event, row: any): Promise<void> => {
    await $router.push({
        name: ROUTES.MISSIONS.routeName,
        params: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            projectUuid: row.uuid,
        },
    });
};
</script>

<style scoped>
.project-card {
    border-radius: 4px;
}

.project-card--selected {
    background-color: #e7efff;
}

.project-card__text {
    overflow-wrap: anywhere;
}
</style>
