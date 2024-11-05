<template>
    <base-dialog ref="dialogRef">
        <template #title> Project Access Rights</template>

        <template #content>
            <ConfigureAccess
                v-model="accessGroups"
                :min-access-rights="minAccessRights"
            />
        </template>

        <template #actions>
            <q-btn
                label="Save"
                flat
                class="bg-button-primary"
                @click="saveChanges"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import ConfigureAccess from 'components/ConfigureAccess.vue';
import {
    AccessRight,
    getDefaultAccessGroups,
    getProject,
} from 'src/services/queries/project';
import { computed, ref, watch } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Project } from 'src/types/Project';
import {
    removeAccessGroupFromProject,
    updateProjectAccess,
} from 'src/services/mutations/access';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    project_uuid: string;
}>();

const { data: project } = useQuery<Project>({
    queryKey: ['project', props.project_uuid],
    queryFn: () => getProject(props.project_uuid),
    enabled: !!props.project_uuid,
});

const { data: defaultRights } = useQuery({
    queryKey: ['defaultRights'],
    queryFn: getDefaultAccessGroups,
});

const accessGroups = ref<AccessRight[]>(
    project.value?.projectAccesses?.map((access) => ({
        name: access.accessGroup?.name,
        uuid: access.accessGroup?.uuid,
        memberCount: '???',
        rights: access.rights,
    })) || [],
);

watch(
    () => project.value?.projectAccesses,
    (newValue) => {
        accessGroups.value =
            newValue?.map((access) => ({
                name: access.accessGroup?.name,
                uuid: access.accessGroup?.uuid,
                memberCount: '???',
                rights: access.rights,
            })) || [];
    },
    { immediate: true },
);

const minAccessRights = computed(() =>
    defaultRights.value
        ? defaultRights.value.filter((r) => r.name.startsWith('Personal: '))
        : [],
);

const queryClient = useQueryClient();
const saveChanges = async () => {
    onDialogOK();

    console.log(accessGroups.value);
    const promises = accessGroups.value.map((access) => {
        return updateProjectAccess(
            props.project_uuid,
            access.uuid,
            access.rights as AccessGroupRights,
        );
    });

    await Promise.all(promises);

    const deletePromises = project.value?.projectAccesses
        ?.filter(
            (group) =>
                !accessGroups.value.some(
                    (access) => access.uuid === group.accessGroup.uuid,
                ),
        )
        .map((group) =>
            removeAccessGroupFromProject(
                props.project_uuid,
                group.accessGroup.uuid,
            ),
        );

    await Promise.all(deletePromises);

    const cache = queryClient.getQueryCache();
    const filtered = cache
        .getAll()
        .filter(
            (query) =>
                query.queryKey[0] === 'project' &&
                query.queryKey[1] === props.project_uuid,
        );

    filtered.forEach((query) => {
        queryClient.invalidateQueries(query.queryKey);
    });
};
</script>

<style scoped></style>
