<template>
    <q-table
        v-if="!isLoading"
        v-model:pagination="pagination"
        v-model:selected="selected"
        flat
        bordered
        :rows-per-page-options="[10, 20, 50, 100]"
        :rows="data"
        :columns="explorerPageTableColumns as any"
        row-key="uuid"
        :loading="isLoading"
        wrap-cells
        virtual-scroll
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
                        @click.stop
                    >
                        <q-menu auto-close>
                            <q-list>
                                <q-item
                                    v-ripple
                                    clickable
                                    @click="(e) => onRowClick(e, props.row)"
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
import { explorerPageTableColumns } from 'components/explorer-page/explorer-page-table-columns';
import { QTable } from 'quasar';
import {
    useFilteredProjects,
    useHandler,
    useUser,
} from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { TableRequest } from 'src/services/query-handler';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const urlHandler = useHandler();

const { myProjects } = defineProps<{ myProjects: boolean }>();
const { data: user } = useUser();

async function setPagination(update: TableRequest): Promise<void> {
    urlHandler.value.setPage(update.pagination.page);
    urlHandler.value.setTake(update.pagination.rowsPerPage);
    urlHandler.value.setSort(update.pagination.sortBy);
    urlHandler.value.setDescending(update.pagination.descending);
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
            ? ({ 'creator.uuid': user.value?.uuid ?? '' } as Record<
                  string,
                  string
              >)
            : {}),
    })),
);

const data = computed(() => (rawData.value ? rawData.value.data : []));
const total = computed(() => (rawData.value ? rawData.value.count : 0));

watch(
    () => total.value,
    () => {
        if (data.value && !isLoading.value) {
            urlHandler.value.rowsNumber = total.value;
        }
    },
    { immediate: true },
);

const $router = useRouter();

const onRowClick = async (_: Event, row: any): Promise<void> => {
    await $router.push({
        name: ROUTES.MISSIONS.routeName,
        params: {
            projectUuid: row.uuid,
        },
    });
};
</script>
