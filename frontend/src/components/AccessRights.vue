<template>
    <div>
        <q-table
            v-if="project"
            :columns="columns"
            title="Your Access Rights"
            :rows="project.projectAccesses"
        />
        <b style="font-size: 30px">Add Users</b>
        <p v-if="!canAddAccessGroupResponse">
            {{
                "You cannot add users: This requires access rights at 'Write' level or higher."
            }}
        </p>
        <div
            class="row"
            style="padding-top: 12px"
            v-if="canAddAccessGroupResponse"
        >
            <div class="col-4">
                <q-input
                    v-model="search"
                    label="Search User"
                    @keyup.enter="refetch"
                />
            </div>
            <div class="col-2 flex flex-center">
                <q-btn label="Search" color="primary" @click="refetch" />
            </div>
            <div class="col-5 flex flex-center">
                <div class="row" v-for="user in foundUsers">
                    <div class="col-8 flex flex-center">
                        {{ user.name }} - {{ user.email }}
                    </div>
                    <div class="col-2 flex flex-center">
                        <q-select v-model="rights" :options="options" />
                    </div>
                    <div class="col-2 flex flex-center">
                        <q-btn
                            label="Add"
                            color="primary"
                            @click="() => mutate(user.uuid)"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useMutation, useQuery } from '@tanstack/vue-query';
import { Project } from 'src/types/Project';
import {
    canAddAccessGroup,
    getProject,
    searchUsers,
} from 'src/services/queries';
import { ProjectAccess } from 'src/types/ProjectAccess';
import { AccessGroupRights } from 'src/enum/ACCESS_RIGHTS';
import { ref } from 'vue';
import { addUsersToProject } from 'src/services/mutations';
import { Notify } from 'quasar';

const props = defineProps<{
    project_uuid: string;
}>();
const projectResponse = useQuery<Project>({
    queryKey: ['project', props.project_uuid],
    queryFn: () => getProject(props.project_uuid),
    enabled: !!props.project_uuid,
});
const search = ref('');
const rights = ref({ value: AccessGroupRights.READ, label: 'Read' });
const project = projectResponse.data;

const { data: foundUsers, refetch } = useQuery({
    queryKey: ['users', search.value],
    queryFn: () => searchUsers(search.value),
    enabled: !!search.value,
});
const columns = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        field: (row: ProjectAccess) => row.accessGroup.name,
        sortable: true,
    },
    {
        name: 'rights',
        required: true,
        label: 'Rights',
        align: 'left',
        field: (row: ProjectAccess) =>
            `${getAccessRightDescription(row.rights)} (${row.rights})`,
        sortable: true,
    },
];

const accessGroupRightsMap = {
    [AccessGroupRights.READ]: 'Read',
    [AccessGroupRights.CREATE]: 'Create',
    [AccessGroupRights.WRITE]: 'Write',
    [AccessGroupRights.DELETE]: 'Delete',
};
const options = Object.keys(accessGroupRightsMap).map((key) => ({
    label: accessGroupRightsMap[parseInt(key, 10) as AccessGroupRights],
    value: parseInt(key, 10),
}));

const { mutate } = useMutation({
    mutationFn: (userUUID: string) =>
        addUsersToProject(
            userUUID,
            project.value?.uuid as string,
            rights.value?.value,
        ),
    onSuccess(data, variables, context) {
        Notify.create({
            message: 'User Added',
            color: 'positive',
        });
    },
    onError(error, variables, context) {
        Notify.create({
            message: 'Error adding user: ' + error.message,
            color: 'negative',
        });
    },
});

const { data: canAddAccessGroupResponse } = useQuery({
    queryKey: ['canAddAccessGroup', project.value?.uuid],
    queryFn: () => canAddAccessGroup(project.value?.uuid),
    enabled: !!project.value?.uuid,
});
function getAccessRightDescription(value: AccessGroupRights): string {
    return accessGroupRightsMap[value] || 'Unknown';
}
</script>

<style scoped></style>
