<template>
    <div style="margin: 10px" class="row flex items-center justify-between">
        <q-select
            v-model="selected"
            use-input
            multiple
            input-debounce="100"
            :options="_foundProjects"
            option-label="name"
            style="width: 65%"
            @input-value="
                (val) => {
                    search = val;
                }
            "
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
                    @remove="scope.removeAtIndex(scope.index)"
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { addAccessGroupToProject } from 'src/services/mutations/access';
import { User } from 'src/types/User';
import { Notify } from 'quasar';
import { filteredProjects } from 'src/services/queries/project';
import { AccessGroupRights } from '@common/enum';

const props = defineProps<{
    access_group_uuid: string;
}>();
const queryClient = useQueryClient();

const search = ref('');
const accessRight = ref({ label: 'None', value: AccessGroupRights.READ });
const selected: Ref<User[]> = ref([]);
const { data: foundProjects } = useQuery({
    queryKey: ['projects', search],
    queryFn: () =>
        filteredProjects(100, 0, 'name', true, { name: search.value }),
});
const _foundProjects = computed(() =>
    foundProjects.value ? foundProjects.value[0] : [],
);
const options = Object.keys(accessGroupRightsMap).map((key) => ({
    label: accessGroupRightsMap[parseInt(key, 10) as AccessGroupRights],
    value: parseInt(key, 10),
}));
const { mutate } = useMutation({
    mutationFn: () => {
        return Promise.all(
            selected.value.map(async (project) => {
                return addAccessGroupToProject(
                    project.uuid,
                    props.access_group_uuid,
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
            queryKey: ['AccessGroup', props.access_group_uuid],
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

defineExpose({ mutate });
</script>

<style scoped></style>
