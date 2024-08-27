<template>
    <div style="margin: 10px">
        <q-table
            v-if="project"
            :columns="AccessRightsColumns"
            flat
            bordered
            :rows="project.projectAccesses"
        />
        <br />
        <b style="font-size: 20px">Add Users / Access Groups</b>
        <p v-if="!canAddAccessGroupResponse">
            {{
                "You cannot add users: This requires access rights at 'Write' level or higher."
            }}
        </p>
        <ModifyAccessGroups
            v-if="canAddAccessGroupResponse"
            @addAccessGroupToProject="_addAccessGroupToProject"
            @addUsersToProject="_addUserToProject"
            :existing-rights="existingRights"
        />
    </div>
</template>

<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { Project } from 'src/types/Project';

import { ProjectAccess } from 'src/types/ProjectAccess';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import { computed, Ref, ref, watch } from 'vue';

import { getProject } from 'src/services/queries/project';
import { canAddAccessGroup } from 'src/services/queries/access';
import ModifyAccessGroups from 'components/ModifyAccessGroups.vue';
import { getAccessRightDescription } from 'src/services/generic';
import {
    addAccessGroupToProject,
    addUsersToProject,
} from 'src/services/mutations/access';
import { Notify, QTable } from 'quasar';

const props = defineProps<{
    project_uuid: string;
}>();

const projectResponse = useQuery<Project>({
    queryKey: ['project', props.project_uuid],
    queryFn: () => getProject(props.project_uuid),
    enabled: !!props.project_uuid,
});
const project = projectResponse.data;
const queryClient = useQueryClient();

const queryKey = computed(() => ['canAddAccessGroup', project.value?.uuid]);
const { data: canAddAccessGroupResponse } = useQuery({
    queryKey: queryKey,
    queryFn: () => canAddAccessGroup(project.value?.uuid as string),
});

const existingRights: Ref<
    Record<string, { label: string; value: AccessGroupRights }>
> = ref({});
watch(
    () => projectResponse.data,
    (newValue) => {
        newValue.value?.projectAccesses.forEach((access) => {
            if (access.accessGroup.personal) {
                existingRights.value[access.accessGroup.users[0].uuid] = {
                    label: getAccessRightDescription(access.rights),
                    value: access.rights,
                };
            } else {
                existingRights.value[access.accessGroup.uuid] = {
                    label: getAccessRightDescription(access.rights),
                    value: access.rights,
                };
            }
        });
    },
    { deep: true, immediate: true },
);

const { mutate: _addAccessGroupToProject } = useMutation({
    //Todo query devalidation
    mutationFn: (update: {
        accessGroupUUID: string;
        rights: AccessGroupRights;
    }) =>
        addAccessGroupToProject(
            project.value?.uuid as string,
            update.accessGroupUUID,
            update.rights,
        ),
    onSuccess(data, variables, context) {
        Notify.create({
            message: 'Access Group Added',
            color: 'positive',
        });
        queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] === 'project' &&
                query.queryKey[1] === project.value?.uuid,
        });
    },
    onError(error, variables, context) {
        Notify.create({
            message: 'Error adding access group: ' + error.message,
            color: 'negative',
        });
    },
});

const { mutate: _addUserToProject } = useMutation({
    //Todo query devalidation
    mutationFn: (update: { userUUID: string; rights: AccessGroupRights }) =>
        addUsersToProject(
            update.userUUID,
            project.value?.uuid as string,
            update.rights,
        ),
    onSuccess(data, variables, context) {
        Notify.create({
            message: 'User Updated',
            color: 'positive',
        });
        queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] === 'project' &&
                query.queryKey[1] === project.value?.uuid,
        });
    },
    onError(error, variables, context) {
        Notify.create({
            message: 'Error adding user: ' + error.message,
            color: 'negative',
        });
    },
});

const AccessRightsColumns = [
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
</script>

<style scoped></style>
