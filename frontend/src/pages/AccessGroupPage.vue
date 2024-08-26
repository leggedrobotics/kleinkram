<template>
    <title-section :title="accessGroup?.name" />
    <q-tabs v-model="tab" align="left">
        <q-tab name="members" label="Members" :disable="personal">
            <q-tooltip v-if="personal">
                Personal Access groups have only the trivial member
            </q-tooltip>
        </q-tab>
        <q-tab name="projects" label="Projects"></q-tab>
    </q-tabs>
    <q-tab-panels v-model="tab">
        <q-tab-panel name="projects">
            <div
                class="row flex justify-end"
                style="padding-left: 0; height: 40px"
            >
                <q-input
                    v-model="search"
                    outlined
                    dense
                    placeholder="Search"
                    style="width: 300px"
                    class="q-mr-sm full-height"
                >
                    <template v-slot:append>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>
                <q-btn
                    icon="sym_o_loop"
                    class="q-mr-sm full-height"
                    unelevated
                    outline
                    @click="() => refetch()"
                />
                <q-btn
                    label="Add Project"
                    color="dark"
                    icon="sym_o_add"
                    style="width: 300px"
                    class="full-height"
                    @click="openAddProject"
                />
            </div>
            <q-table
                ref="tableRef"
                v-model:pagination="pagination"
                :rows="project_rows"
                :columns="project_cols"
                style="margin-top: 8px"
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
                                    <q-item clickable v-ripple disabled>
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
            <div
                class="row flex justify-end"
                style="padding-left: 0; height: 40px"
            >
                <q-input
                    v-model="search"
                    outlined
                    dense
                    placeholder="Search"
                    style="width: 300px"
                    class="q-mr-sm full-height"
                >
                    <template v-slot:append>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>
                <q-btn
                    icon="sym_o_loop"
                    class="q-mr-sm full-height"
                    unelevated
                    outline
                    @click="() => refetch()"
                />
                <q-btn
                    label="Add User"
                    color="dark"
                    icon="sym_o_add"
                    style="width: 300px"
                    class="full-height"
                    @click="openAddUser"
                />
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
                                    <q-item clickable v-ripple disabled>
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
import { useQuery } from '@tanstack/vue-query';
import { getAccessGroup } from 'src/services/queries/access';
import { useRouter } from 'vue-router';
import { computed, ref, watch } from 'vue';
import { explorer_page_table_columns } from 'components/explorer_page/explorer_page_table_columns';
import { ProjectAccess } from 'src/types/ProjectAccess';
import { useQuasar } from 'quasar';
import AddUserToAccessGroupDialog from 'src/dialogs/AddUserToAccessGroupDialog.vue';
import AddProjectToAccessGroupDialog from 'src/dialogs/AddProjectToAccessGroupDialog.vue';
import TitleSection from 'components/TitleSection.vue';

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

const { data: accessGroup, refetch } = useQuery({
    queryKey: ['AccessGroup', uuid],
    queryFn: async () => {
        return getAccessGroup(uuid.value as string);
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
            field: (row: any) => row.rights,
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
        style: 'width: 10%',
    },
    {
        name: 'role',
        required: true,
        label: 'Role',
        align: 'right',
        field: (row: any) => row.role,
        format: (val: string) => `${val}`,
        style: 'width: 75%',
    },
    {
        name: 'actions',
        required: true,
        label: 'Actions',
        align: 'center',
        field: 'actions',
        style: 'width: 5%',
    },
];
</script>
<style scoped></style>
