<template>
    <div style="margin: 10px" class="row flex items-center justify-between">
        <q-select
            v-model="selected"
            @input-value="
                (val) => {
                    search = val;
                }
            "
            use-input
            multiple
            input-debounce="100"
            :options="_foundUsers"
            option-label="name"
            style="width: 60%"
        >
            <template v-slot:no-option>
                <q-item>
                    <q-item-section class="text-grey">
                        No results
                    </q-item-section>
                </q-item>
            </template>
            <template v-slot:selected-item="scope">
                <q-chip
                    removable
                    @remove="scope.removeAtIndex(scope.index)"
                    :tabindex="scope.tabindex"
                    :icon="icon(scope.opt.type)"
                >
                    {{ scope.opt.name }}
                </q-chip>
            </template>
            <template v-slot:option="{ itemProps, opt }">
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
            style="width: 20%"
        />
        <q-btn
            color="primary"
            outline
            icon="sym_o_save"
            label="Save"
            @click="() => mutate()"
            :disable="accessRight.value === AccessGroupRights.NONE"
        />
    </div>
</template>
<script setup lang="ts">
import { computed, Ref, ref } from 'vue';
import { accessGroupRightsMap, icon } from 'src/services/generic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { searchUsers } from 'src/services/queries/user';
import {
    addAccessGroupToProject,
    addUserToAccessGroup,
} from 'src/services/mutations/access';
import { User } from 'src/types/User';
import { Notify } from 'quasar';
import { canAddAccessGroup } from 'src/services/queries/access';
import { filteredProjects } from 'src/services/queries/project';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
const props = defineProps<{
    access_group: string;
}>();
const queryClient = useQueryClient();

const search = ref('');
const accessRight = ref({ label: 'None', value: AccessGroupRights.NONE });
const selected: Ref<User[]> = ref([]);
const { data: foundUsers } = useQuery({
    queryKey: ['projects', search],
    queryFn: () =>
        filteredProjects(100, 0, 'name', true, { name: search.value }),
});
const _foundUsers = computed(() =>
    foundUsers.value ? foundUsers.value[0] : [],
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
                    props.access_group,
                    accessRight.value.value,
                );
            }),
        );
    },
    onSuccess: () => {
        Notify.create({
            message: 'Access group added to project',
            color: 'positive',
            position: 'bottom',
        });
        queryClient.invalidateQueries({
            queryKey: ['AccessGroup', props.access_group],
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
</script>

<style scoped></style>
