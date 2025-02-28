<template>
    <div style="margin: 10px" class="row flex items-center justify-between">
        <q-select
            v-model="selected"
            use-input
            multiple
            input-debounce="100"
            :options="_foundProjects"
            option-label="name"
            label="Select Project"
            style="width: 65%"
            @input-value="onInputUpdate"
        >
            <template #no-option>
                <q-item>
                    <q-item-section class="text-grey">
                        No results
                    </q-item-section>
                </q-item>
            </template>
            <template #selected-item="scope">
                <q-chip
                    removable
                    :tabindex="scope.tabindex"
                    :icon="icon(scope.opt.type)"
                    @remove="() => scope.removeAtIndex(scope.index)"
                >
                    {{ scope.opt.name }}
                </q-chip>
            </template>
            <template #option="{ itemProps, opt }">
                <q-item v-bind="itemProps">
                    <q-item-section>
                        <q-item-label>
                            {{ opt.name }}
                        </q-item-label>
                    </q-item-section>
                </q-item>
            </template>
        </q-select>
        <q-select
            v-model="accessRight"
            :options="options"
            label="Select Access Rights"
            style="width: 30%"
        />
    </div>
</template>
<script setup lang="ts">
import { computed, Ref, ref } from 'vue';
import { accessGroupRightsMap, icon } from 'src/services/generic';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { addAccessGroupToProject } from 'src/services/mutations/access';
import { Notify } from 'quasar';
import { AccessGroupRights } from '@common/enum';
import { UserDto } from '@api/types/user.dto';
import { useFilteredProjects } from '../hooks/query-hooks';

const properties = defineProps<{
    access_group_uuid: string;
}>();
const queryClient = useQueryClient();

const search = ref('');
const accessRight = ref({ label: 'Read', value: AccessGroupRights.READ });
const selected: Ref<UserDto[]> = ref([]);
const { data: foundProjects } = useFilteredProjects(100, 0, 'name', true, {
    name: search.value,
});
const _foundProjects = computed(() =>
    foundProjects.value ? foundProjects.value.data : [],
);
const options = Object.keys(accessGroupRightsMap)
    .map((key) => ({
        label: accessGroupRightsMap[
            Number.parseInt(key, 10) as AccessGroupRights
        ],
        value: Number.parseInt(key, 10),
    }))
    .filter((option) => option.value !== AccessGroupRights._ADMIN);

const { mutate } = useMutation({
    mutationFn: () => {
        return Promise.all(
            selected.value.map(async (project) => {
                return addAccessGroupToProject(
                    project.uuid,
                    properties.access_group_uuid,
                    accessRight.value.value,
                );
            }),
        );
    },
    onSuccess: async () => {
        Notify.create({
            message: 'Access group added to project',
            color: 'positive',
            position: 'bottom',
        });
        await queryClient.invalidateQueries({
            queryKey: ['AccessGroup', properties.access_group_uuid],
        });
    },
    onError: () => {
        Notify.create({
            message: 'Failed to add some projects to access group',
            color: 'negative',
            position: 'bottom',
        });
    },
});

const onInputUpdate = (value: string) => {
    search.value = value;
};

defineExpose({ mutate });
</script>

<style scoped></style>
