<template>
    <q-page>
        <div class="q-pa-md">
            <div class="text-h4">Access Rights</div>
            <p>
                Access Rights allows you to manage the access rights of the
                users and blablabla lorem ipsum dolor sit amet.
            </p>
            <q-form @submit="() => _createAccessGroup()">
                <b>Create Access Group</b>
                <div class="row">
                    <div class="col-3">
                        <q-input
                            v-model="name"
                            label="Access Group Name"
                            required
                        />
                    </div>
                    <div class="col-5">
                        <q-btn color="primary" label="Create" type="submit" />
                    </div>
                </div>
            </q-form>
            <q-separator style="margin-top: 12px; margin-bottom: 12px" />
            <q-form @submit="() => refetchAccessGroups()">
                <b>Add Users to Access Group</b>
                <div class="row">
                    <div class="col-3">
                        <q-input
                            v-model="searchAccessGroup"
                            label="Select Access Group"
                            required
                        />
                    </div>
                    <div class="col-1">
                        <q-btn color="primary" label="Find" type="submit" />
                    </div>
                    <div class="col-5">
                        <q-form>
                            <div
                                class="row"
                                v-for="accessgroup in foundAccessGroups"
                                style="margin-top: 3px"
                            >
                                <div class="col-4 flex flex-center">
                                    {{ accessgroup.name }}
                                </div>
                                <div class="col-2 flex flex-center">
                                    <q-btn
                                        label="Select"
                                        color="primary"
                                        @click="
                                            () => selectAccessGroup(accessgroup)
                                        "
                                    />
                                </div>
                            </div>
                        </q-form>
                    </div>
                </div>
            </q-form>
            <div
                class="row"
                v-for="accessGroup in selectedAccessGroup"
                :key="accessGroup.uuid"
                style="margin-top: 20px"
            >
                <b class="col-1 flex flex-center">{{ accessGroup.name }}</b>
                <div class="col-2">
                    <q-input
                        v-model="searchUser"
                        label="Search User"
                        @keyup.enter="refetch"
                    />
                </div>
                <div class="col-1 flex flex-center">
                    <q-btn
                        label="Search"
                        color="primary"
                        @click="() => refetch"
                    />
                </div>
                <div class="col-5 flex flex-center">
                    <q-form>
                        <div class="row" v-for="user in foundUsers">
                            <div class="col-8 flex flex-center">
                                {{ user.name }} - {{ user.email }}
                            </div>
                            <div class="col-2 flex flex-center">
                                <q-btn
                                    label="Add"
                                    color="primary"
                                    @click="
                                        () =>
                                            addUserMutation({
                                                userUUID: user.uuid,
                                                accessGroupUUID:
                                                    accessGroup.uuid,
                                            })
                                    "
                                />
                            </div>
                        </div>
                    </q-form>
                </div>
            </div>
            <q-separator style="margin-top: 12px; margin-bottom: 12px" />
            <div>
                <b>Add Access Group / Users to Projects</b>
            </div>
            <q-table
                ref="tableRef"
                v-model:pagination="pagination"
                title="Projects"
                :rows="data"
                :columns="project_columns"
                style="margin-top: 8px"
                selection="multiple"
                v-model:selected="selectedProjects"
                row-key="uuid"
            >
                <template v-slot:body-cell-projectaction="props">
                    <q-td :props="props">
                        <q-btn
                            color="primary"
                            label="Edit"
                            @click="() => openAccessRightsModal(props.row)"
                        ></q-btn>
                    </q-td>
                </template>
            </q-table>
        </div>
    </q-page>
</template>
<script setup lang="ts">
import { useMutation, useQuery } from '@tanstack/vue-query';

import { searchUsers } from 'src/services/queries/user';

import { Ref, ref } from 'vue';
import { formatDate } from 'src/services/dateFormating';
import { Project } from 'src/types/Project';

import { Notify, useQuasar } from 'quasar';
import { AccessGroup } from 'src/types/AccessGroup';
import AccessRightsDialog from 'src/dialogs/AccessRightsDialog.vue';
import { searchAccessGroups } from 'src/services/queries/access';
import { filteredProjects } from 'src/services/queries/project';
import {
    addUserToAccessGroup,
    createAccessGroup,
} from 'src/services/mutations/access';

const name = ref('');
const searchAccessGroup = ref('');
const searchUser = ref('');
const selectedAccessGroup: Ref<AccessGroup[]> = ref([]);
const selectedProjects: Ref<Project[]> = ref([]);
const $q = useQuasar();

const { mutate: _createAccessGroup } = useMutation({
    mutationFn: () => createAccessGroup(name.value),
    onSuccess: (data) => {
        Notify.create({
            message: 'Access Group created',
            color: 'positive',
        });
        selectedAccessGroup.value = [data];
        name.value = '';
    },
    onError: (error) => {
        Notify.create({
            message: "Couldn't create Access Group: " + error,
            color: 'negative',
        });
    },
});

const selectAccessGroup = (accessGroup: AccessGroup) => {
    selectedAccessGroup.value = [accessGroup];
};

const { mutate: addUserMutation } = useMutation({
    mutationFn: (params: { userUUID: string; accessGroupUUID: string }) =>
        addUserToAccessGroup(params.userUUID, params.accessGroupUUID),
    onSuccess: () => {
        Notify.create({
            message: 'User added to Access Group',
            color: 'positive',
        });
    },
    onError: (error) => {
        Notify.create({
            message: "Couldn't add user to Access Group: " + error,
            color: 'negative',
        });
    },
});

const { data: foundUsers, refetch } = useQuery({
    queryKey: ['users', searchUser.value],
    queryFn: () => searchUsers(searchUser.value),
    enabled: !!searchUser.value,
});

const { data: foundAccessGroups, refetch: refetchAccessGroups } = useQuery({
    queryKey: ['accessGroups', searchAccessGroup.value],
    queryFn: () => searchAccessGroups(searchAccessGroup.value),
    enabled: !!searchAccessGroup.value,
});

const { data } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name'),
});

const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 30,
});
const project_columns = [
    {
        name: 'Project',
        required: true,
        label: 'Project',
        align: 'left',
        field: (row: Project) => row.name,
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width:  10%; max-width: 10%; min-width: 10%;',
    },
    {
        name: 'Description',
        required: true,
        label: 'Description',
        align: 'left',
        field: (row: Project) => row.description || '',
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width:  60%; max-width: 60%; min-width: 60%;',
    },

    {
        name: 'Creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: Project) => (row.creator ? row.creator.name : ''),
        format: (val: number) => `${val}`,
        sortable: true,
        style: 'width:  10%; max-width: 10%; min-width: 10%;',
    },
    {
        name: 'Created',
        required: true,
        label: 'Created',
        align: 'left',
        field: (row: Project) => row.createdAt,
        format: (val: string) => formatDate(new Date(val)),
        sortable: true,
    },
    {
        name: 'NrOfMissions',
        required: true,
        label: 'Nr of Missions',
        align: 'left',
        field: (row: Project) => row.missions.length,
        format: (val: number) => `${val}`,
        sortable: true,
    },
    {
        name: 'projectaction',
        label: 'Action',
        align: 'center',
    },
];

function openAccessRightsModal(project: Project) {
    $q.dialog({
        component: AccessRightsDialog,
        componentProps: {
            project_uuid: project.uuid,
        },
    });
}
</script>

<style scoped></style>
