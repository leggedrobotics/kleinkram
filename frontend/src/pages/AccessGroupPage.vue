<template>
    <title-section :title="'Group: ' + accessGroup?.name">
        <template #tabs>
            <q-tabs
                v-model="tab"
                align="left"
                active-color="primary"
                dense
                class="text-grey"
            >
                <q-tab
                    name="members"
                    label="Members"
                    :disable="personal"
                    style="color: #222"
                >
                    <q-tooltip v-if="personal">
                        Personal Access groups have only the trivial member
                    </q-tooltip>
                </q-tab>
                <q-tab name="projects" label="Projects" style="color: #222" />
            </q-tabs>
        </template>
    </title-section>

    <q-tab-panels v-model="tab" class="q-mt-lg" style="background: transparent">
        <q-tab-panel name="projects">
            <div class="flex justify-between items-center q-mb-lg">
                <div />
                <button-group>
                    <q-input
                        v-model="search"
                        outlined
                        dense
                        placeholder="Search"
                        class="q-mr-sm full-height"
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
                        @click="() => refetch()"
                    >
                        <q-tooltip> Refetch the Data</q-tooltip>
                    </q-btn>
                    <q-btn
                        flat
                        class="bg-button-secondary text-on-color"
                        label="Add Project"
                        icon="sym_o_add"
                        @click="openAddProject"
                    />
                </button-group>
            </div>

            <q-table
                flat
                bordered
                separator="none"
                ref="tableRef"
                v-model:pagination="pagination"
                :rows="project_rows"
                :columns="project_cols"
                selection="multiple"
                v-model:selected="selectedProjects"
                row-key="uuid"
                :filter="search"
            >
                <template v-slot:body-selection="props">
                    <q-checkbox
                        v-model="props.selected"
                        color="grey-8"
                        class="checkbox-with-hitbox"
                    />
                </template>
                <template v-slot:body-cell-projectaction="props">
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
                                        style="width: 180px"
                                        clickable
                                        v-ripple
                                        @click="() => _rowClick(props.row.uuid)"
                                    >
                                        <q-item-section
                                            >View Project Details
                                        </q-item-section>
                                    </q-item>

                                    <ChangeProjectRightsDialogOpener
                                        :projectUUID="props.row.uuid"
                                        :projectAccessUUID="
                                            props.row.project_access_uuid
                                        "
                                    >
                                        <q-item clickable v-ripple>
                                            <q-item-section>
                                                Change rights
                                            </q-item-section>
                                        </q-item>
                                    </ChangeProjectRightsDialogOpener>
                                    <RemoveProjectDialogOpener
                                        :access-group="accessGroup"
                                        :projectUUID="props.row.uuid"
                                    >
                                        <q-item clickable v-ripple>
                                            <q-item-section>
                                                Remove
                                            </q-item-section>
                                        </q-item>
                                    </RemoveProjectDialogOpener>
                                </q-list>
                            </q-menu>
                        </q-btn>
                    </q-td>
                </template>
            </q-table>
        </q-tab-panel>
        <q-tab-panel name="members">
            <div class="flex justify-between items-center q-mb-lg">
                <div />
                <button-group>
                    <q-input
                        v-model="search"
                        outlined
                        dense
                        placeholder="Search"
                        class="q-mr-sm full-height"
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
                        @click="() => refetch()"
                    >
                        <q-tooltip> Refetch the Data</q-tooltip>
                    </q-btn>

                    <AddUserDialogOpener
                        v-if="accessGroup"
                        :accessGroup="accessGroup"
                    >
                        <q-btn
                            flat
                            class="bg-button-secondary text-on-color full-height"
                            label="Add User"
                            icon="sym_o_add"
                        />
                    </AddUserDialogOpener>
                </button-group>
            </div>
            <q-table
                :rows="accessGroup?.users || []"
                v-model:pagination="pagination2"
                :columns="user_cols"
                style="margin-top: 8px"
                selection="multiple"
                v-model:selected="selectedUsers"
                row-key="uuid"
                :filter="search"
            >
                <template v-slot:body-selection="props">
                    <q-checkbox
                        v-model="props.selected"
                        color="grey-8"
                        class="checkbox-with-hitbox"
                    />
                </template>
                <template v-slot:body-cell-actions="props">
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
                                        style="width: 180px"
                                        clickable
                                        v-ripple
                                        @click=""
                                        disable
                                    >
                                        <q-item-section
                                            >View Details
                                        </q-item-section>
                                        <q-tooltip>
                                            You can't view details of a user!
                                        </q-tooltip>
                                    </q-item>

                                    <q-item clickable v-ripple disabled>
                                        <q-item-section>Edit</q-item-section>
                                        <q-tooltip>
                                            You can't edit a user!
                                        </q-tooltip>
                                    </q-item>
                                    <q-item
                                        clickable
                                        v-ripple
                                        @click="
                                            () => _removeUser(props.row.uuid)
                                        "
                                    >
                                        <q-item-section>Remove</q-item-section>
                                    </q-item>
                                </q-list>
                            </q-menu>
                        </q-btn>
                    </q-td>
                </template>
            </q-table>
        </q-tab-panel>
    </q-tab-panels>
</template>
<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { getAccessGroup } from 'src/services/queries/access';
import { useRouter } from 'vue-router';
import { computed, ref, watch } from 'vue';
import { explorerPageTableColumns } from 'components/explorer_page/explorer_page_table_columns';
import { ProjectAccess } from 'src/types/ProjectAccess';
import { Notify, QTable, useQuasar } from 'quasar';
import AddUserToAccessGroupDialog from 'src/dialogs/AddUserToAccessGroupDialog.vue';
import AddProjectToAccessGroupDialog from 'src/dialogs/AddProjectToAccessGroupDialog.vue';
import TitleSection from 'components/TitleSection.vue';
import ButtonGroup from 'components/ButtonGroup.vue';
import {
    removeAccessGroupFromProject,
    removeUserFromAccessGroup,
} from 'src/services/mutations/access';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import ROUTES from 'src/router/routes';
import ChangeAccessRightsDialog from 'src/dialogs/ChangeAccessRightsDialog.vue';
import RemoveProjectDialogOpener from 'components/buttonWrapper/RemoveProjectDialogOpener.vue';
import ChangeProjectRightsDialogOpener from 'components/buttonWrapper/ChangeProjectRightsDialogOpener.vue';
import AddUserDialogOpener from 'components/buttonWrapper/AddUserDialogOpener.vue';

const $q = useQuasar();
const router = useRouter();
const tab = ref('members');
const uuid = computed(() => router.currentRoute.value.params.uuid);
const selectedProjects = ref([]);
const selectedUsers = ref([]);

const search = ref('');

const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 30,
});

const pagination2 = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 30,
});

const queryClient = useQueryClient();

const { data: accessGroup, refetch } = useQuery({
    queryKey: ['AccessGroup', uuid],
    queryFn: async () => {
        return getAccessGroup(uuid.value as string);
    },
});

const { mutate: _removeUser } = useMutation({
    mutationFn: (userUUID) => removeUserFromAccessGroup(userUUID, uuid.value),
    onSuccess: () => {
        queryClient.invalidateQueries({
            queryKey: ['AccessGroup', uuid],
        });
        Notify.create({
            message: 'User removed from access group',
            color: 'positive',
            position: 'bottom',
        });
    },
    onError: () => {
        Notify.create({
            message: 'Error removing user from access group',
            color: 'negative',
            position: 'bottom',
        });
    },
});
const personal = computed(() => accessGroup.value?.personal);

watch(
    () => personal.value,
    (value) => {
        if (value) {
            tab.value = 'projects';
        }
    },
    { immediate: true },
);

const project_rows = computed(() => {
    console.log(accessGroup.value);
    return accessGroup.value?.projectAccesses.map((project: ProjectAccess) => {
        return {
            ...project.project,
            rights: project.rights,
            project_access_uuid: project.uuid,
        };
    });
});

function openAddProject() {
    $q.dialog({
        component: AddProjectToAccessGroupDialog,
        componentProps: {
            access_group_uuid: uuid.value,
        },
    });
}

const rename_columns = (cols: any[], old_label: string, new_label: string) => {
    cols.filter((col) => col.label === old_label).forEach((col) => {
        col.label = new_label;
    });
};

const drop_columns = (cols: any[], label: string) => {
    return cols.filter((col) => col.label !== label);
};

const project_cols = computed(() => {
    {
        let defaultCols = [...explorerPageTableColumns];
        rename_columns(defaultCols, 'Creator', 'Project Creator');
        rename_columns(defaultCols, 'Description', 'Project Description');
        defaultCols = drop_columns(defaultCols, 'Created');

        // add as the second to last column
        defaultCols.splice(defaultCols.length - 2, 1, {
            name: 'rights',
            required: true,
            label: 'Group Rights',
            style: 'max-width: 100px',
            align: 'left',
            field: (row: any) => AccessGroupRights[row.rights],
        });
        return defaultCols;
    }
});
const user_cols = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        field: (row: any) => row.name,
        format: (val: string) => `${val}`,
        style: 'width: 10%',
    },
    {
        name: 'email',
        required: true,
        label: 'Email',
        align: 'left',
        field: (row: any) => row.email,
        format: (val: string) => `${val}`,
    },
    {
        name: 'actions',
        required: true,
        label: '',
        align: 'center',
        field: 'actions',
        style: 'width: 5%',
    },
];

const _rowClick = (uuid: string) => {
    router?.push({
        name: ROUTES.MISSIONS.routeName,
        params: {
            project_uuid: uuid,
        },
    });
};
</script>
<style scoped></style>
