<template>
    <div>
        <q-table
            v-if="project"
            :columns="columns"
            title="Access Rights"
            :rows="project.projectAccesses"
        />
        <b style="font-size: 30px">Add Users / Access Groups</b>
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
                    label="Search User / Access Group"
                    @keyup.enter="refetch"
                />
            </div>
            <div class="col-2 flex flex-center">
                <q-btn
                    label="Search"
                    color="primary"
                    @click="() => refetch()"
                />
            </div>
            <div class="col-5">
                <div class="row">
                    <b>Individual Users</b>
                </div>
                <div class="row" v-for="user in foundUsers">
                    <div class="col-8 flex flex-center">
                        {{ user.name }} - {{ user.email }}
                    </div>
                    <div class="col-2 flex flex-center">
                        <q-select
                            v-model="rights[user.uuid]"
                            :options="options"
                        />
                    </div>
                    <div class="col-2 flex flex-center">
                        <q-btn
                            label="Update"
                            color="primary"
                            @click="() => mutate(user.uuid)"
                            :disable="
                                !rights[user.uuid] ||
                                rights[user.uuid].value ===
                                    AccessGroupRights.NONE
                            "
                        />
                    </div>
                </div>
                <div class="row">
                    <b>Access Groups</b>
                </div>
                <div class="row" v-for="accessGroup in foundAccessGroups">
                    <div class="col-8 flex flex-center">
                        {{ accessGroup.name }}
                    </div>
                    <div class="col-2 flex flex-center">
                        <q-select
                            v-model="rights[accessGroup.uuid]"
                            :options="options"
                        />
                    </div>
                    <div class="col-2 flex flex-center">
                        <q-btn
                            label="Update"
                            color="primary"
                            @click="
                                () => _addAccessGroupToProject(accessGroup.uuid)
                            "
                            :disable="
                                !rights[accessGroup.uuid] ||
                                rights[accessGroup.uuid].value ===
                                    AccessGroupRights.NONE
                            "
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

import { ProjectAccess } from 'src/types/ProjectAccess';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import { computed, Ref, ref, watch } from 'vue';

import { Notify } from 'quasar';
import { getProject } from 'src/services/queries/project';
import { searchUsers } from 'src/services/queries/user';
import {
    canAddAccessGroup,
    searchAccessGroups,
} from 'src/services/queries/access';
import {
    addAccessGroupToProject,
    addUsersToProject,
} from 'src/services/mutations/access';

const props = defineProps<{
    project_uuid: string;
}>();

const accessGroupRightsMap = {
    [AccessGroupRights.NONE]: 'None',
    [AccessGroupRights.READ]: 'Read',
    [AccessGroupRights.CREATE]: 'Create',
    [AccessGroupRights.WRITE]: 'Write',
    [AccessGroupRights.DELETE]: 'Delete',
};
const projectResponse = useQuery<Project>({
    queryKey: ['project', props.project_uuid],
    queryFn: () => getProject(props.project_uuid),
    enabled: !!props.project_uuid,
});
const project = projectResponse.data;

const queryKey = computed(() => ['canAddAccessGroup', project.value?.uuid]);
const { data: canAddAccessGroupResponse } = useQuery({
    queryKey: queryKey,
    queryFn: () => canAddAccessGroup(project.value?.uuid),
});
const search = ref('');
const rights: Ref<Record<string, { label: string; value: AccessGroupRights }>> =
    ref({});
watch(
    () => projectResponse.data,
    (newValue) => {
        newValue.value?.projectAccesses.forEach((access) => {
            if (access.accessGroup.personal) {
                rights.value[access.accessGroup.users[0].uuid] = {
                    label: getAccessRightDescription(access.rights),
                    value: access.rights,
                };
            } else {
                rights.value[access.accessGroup.uuid] = {
                    label: getAccessRightDescription(access.rights),
                    value: access.rights,
                };
            }
        });
    },
    { deep: true, immediate: true },
);
const { data: foundUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['users', search.value],
    queryFn: () => searchUsers(search.value),
    enabled: !!search.value,
});

const { data: foundAccessGroups, refetch: refetchAccessGroups } = useQuery({
    queryKey: ['accessGroups', search.value],
    queryFn: () => searchAccessGroups(search.value),
    enabled: !!search.value,
});
const refetch = () => {
    console.log('refetching');
    refetchUsers();
    refetchAccessGroups();
};
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

const options = Object.keys(accessGroupRightsMap).map((key) => ({
    label: accessGroupRightsMap[parseInt(key, 10) as AccessGroupRights],
    value: parseInt(key, 10),
}));

const { mutate } = useMutation({
    mutationFn: (userUUID: string) =>
        addUsersToProject(
            userUUID,
            project.value?.uuid as string,
            rights.value[userUUID].value,
        ),
    onSuccess(data, variables, context) {
        Notify.create({
            message: 'User Updated',
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

const { mutate: _addAccessGroupToProject } = useMutation({
    mutationFn: (accessGroupUUID: string) =>
        addAccessGroupToProject(
            project.value?.uuid as string,
            accessGroupUUID,

            rights.value[accessGroupUUID].value,
        ),
    onSuccess(data, variables, context) {
        Notify.create({
            message: 'Access Group Added',
            color: 'positive',
        });
    },
    onError(error, variables, context) {
        Notify.create({
            message: 'Error adding access group: ' + error.message,
            color: 'negative',
        });
    },
});

function getAccessRightDescription(value: AccessGroupRights): string {
    return accessGroupRightsMap[value] || 'Unknown';
}
</script>

<style scoped></style>
