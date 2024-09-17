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
                                    <q-item clickable v-ripple disable>
                                        <q-item-section
                                            >View Details
                                        </q-item-section>
                                    </q-item>
                                    <q-item
                                        clickable
                                        v-ripple
                                        @click="
                                            () => _removeProject(props.row.uuid)
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

                    <q-btn
                        flat
                        class="bg-button-secondary text-on-color"
                        label="Add User"
                        icon="sym_o_add"
                        @click="openAddUser"
                    />
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
                                        clickable
                                        v-ripple
                                        @click=""
                                        disable
                                    >
                                        <q-item-section
                                            >View Details
                                        </q-item-section>
                                    </q-item>

                                    <q-item clickable v-ripple disabled>
                                        <q-item-section>Edit</q-item-section>
                                    </q-item>
                                    <q-item
                                        clickable
                                        v-ripple
                                        @click="
                                            () => _removeUser(props.row.uuid)
                                        "
                                    >
                                        <q-item-section>Delete</q-item-section>
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
import { explorer_page_table_columns } from 'components/explorer_page/explorer_page_table_columns';
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

const { mutate: _removeProject } = useMutation({
    mutationFn: (projectUUID) =>
        removeAccessGroupFromProject(projectUUID, uuid.value),
    onSuccess: () => {
        queryClient.invalidateQueries({
            queryKey: ['AccessGroup', uuid],
        });
        Notify.create({
            message: 'Project removed from access group',
            color: 'positive',
            position: 'bottom',
        });
    },
    onError: () => {
        Notify.create({
            message: 'Error removing project from access group',
            color: 'negative',
            position: 'bottom',
        });
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
    return accessGroup.value?.project_accesses.map((project: ProjectAccess) => {
        return {
            ...project.project,
            rights: project.rights,
        };
    });
});

function openAddProject() {
    $q.dialog({
        component: AddProjectToAccessGroupDialog,
        componentProps: {
            access_group: uuid.value,
        },
    });
}

function openAddUser() {
    $q.dialog({
        component: AddUserToAccessGroupDialog,
        componentProps: {
            access_group: uuid.value,
        },
    });
}

const project_cols = computed(() => {
    {
        const defaultCols = [...explorer_page_table_columns];
        //add as the second to last column
        defaultCols.splice(defaultCols.length - 2, 1, {
            name: 'rights',
            required: true,
            label: 'Rights',
            align: 'center',
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
</script>
<style scoped></style>
