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
import { getProject } from 'src/services/queries/project';
import { computed, ref, watch } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import {
    removeAccessGroupFromProject,
    updateProjectAccess,
} from 'src/services/mutations/access';
import { useProjectDefaultAccess } from '../hooks/customQueryHooks';
import { AccessGroupType } from '@common/enum';
import { DefaultRightDto } from '@api/types/DefaultRights.dto';
import { ProjectDto } from '@api/types/Project.dto';
import { AccessGroupDto } from '@api/types/User.dto';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const properties = defineProps<{
    project_uuid: string;
}>();

const { data: project } = useQuery<ProjectDto>({
    queryKey: ['project', properties.project_uuid],
    queryFn: () => getProject(properties.project_uuid),
    enabled: !!properties.project_uuid,
});

const { data: defaultRights } = useProjectDefaultAccess();

const accessGroups = ref<DefaultRightDto[]>(
    // @ts-ignore
    project.value?.projectAccesses?.map((access: any) => ({
        name: access.accessGroup?.name,
        uuid: access.accessGroup?.uuid,
        memberCount: access.accessGroup?.memberships?.length || '???',
        rights: access.rights,
    })) || [],
);

watch(
    // @ts-ignore
    () => project.value?.projectAccesses,
    (newValue) => {
        accessGroups.value =
            // @ts-ignore
            newValue?.map((access) => ({
                name: access.accessGroup?.name,
                uuid: access.accessGroup?.uuid,
                memberCount: access.accessGroup?.memberships?.length || '???',
                rights: access.rights,
            })) || [];
    },
    { immediate: true },
);

const minAccessRights = computed(() =>
    defaultRights.value
        ? defaultRights.value.defaultRights.filter(
              (r) => r.type === AccessGroupType.PRIMARY,
          )
        : [],
);

const queryClient = useQueryClient();
const saveChanges = async () => {
    onDialogOK();

    console.log(accessGroups.value);
    const promises = accessGroups.value.map((access) => {
        return updateProjectAccess(
            properties.project_uuid,
            access.uuid,
            access.rights,
        );
    });

    await Promise.all(promises);

    // @ts-ignore
    const deletePromises = project.value?.projectAccesses
        ?.filter(
            (group: AccessGroupDto) =>
                !accessGroups.value.some(
                    // @ts-ignore
                    (access) => access.uuid === group.accessGroup.uuid,
                ),
        )
        // @ts-ignore
        .map((group) =>
            removeAccessGroupFromProject(
                properties.project_uuid,
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
                query.queryKey[1] === properties.project_uuid,
        );

    await Promise.all(
        filtered.map((query) =>
            queryClient.invalidateQueries({
                queryKey: query.queryKey,
            }),
        ),
    );
};
</script>

<style scoped></style>
