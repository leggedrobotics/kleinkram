<template>
    <div class="column q-pt-sm">
        <q-select
            ref="selectReference"
            v-model="selectedSearchItem"
            outlined
            use-input
            hide-selected
            fill-input
            hide-dropdown-icon
            input-debounce="300"
            placeholder="Search projects..."
            class="q-pb-md"
            autocomplete="off"
            :options="_foundProjects"
            @filter="handleSearchFilter"
            @click="enableSearchMode"
        >
            <template #append>
                <q-icon name="sym_o_search" />
            </template>

            <template #no-option>
                <q-item v-if="isSearchActive && _foundProjects.length === 0">
                    <q-item-section class="text-grey"
                        >No results</q-item-section
                    >
                </q-item>
            </template>

            <template #option="{ opt }">
                <q-item
                    v-ripple
                    clickable
                    :disable="getExistingRight(opt.uuid) !== undefined"
                    @click.stop="() => handleAddProject(opt)"
                >
                    <q-item-section avatar>
                        <q-icon
                            name="sym_o_box"
                            size="md"
                            class="text-grey-8"
                        />
                    </q-item-section>

                    <q-item-section>
                        <q-item-label
                            :class="{
                                'text-grey':
                                    getExistingRight(opt.uuid) !== undefined,
                            }"
                        >
                            {{ opt.name }}
                        </q-item-label>
                    </q-item-section>

                    <q-item-section
                        v-if="getExistingRight(opt.uuid) !== undefined"
                        side
                    >
                        <q-badge
                            color="grey-3"
                            text-color="primary"
                            :label="
                                getAccessRightDescription(
                                    getExistingRight(opt.uuid)!,
                                )
                            "
                        />
                    </q-item-section>
                </q-item>
            </template>
        </q-select>

        <q-table
            v-if="selectedProjects.length > 0"
            class="table-white q-mt-xs"
            :columns="columns"
            :rows="selectedProjects"
            hide-pagination
            flat
            separator="horizontal"
            bordered
            style="max-height: 360px"
            binary-state-sort
            :rows-per-page-options="[0]"
        >
            <template #body-cell-name="props">
                <q-td :props="props">
                    <div class="row items-center no-wrap">
                        <q-icon
                            name="sym_o_box"
                            size="md"
                            class="q-mr-sm text-grey-8"
                        />
                        <span style="font-size: 1.2em">{{
                            props.row.name
                        }}</span>
                    </div>
                </q-td>
            </template>

            <template #body-cell-rights="props">
                <q-td :props="props">
                    <q-btn-dropdown
                        flat
                        outlined
                        class="bg-grey-3"
                        :label="getAccessRightDescription(props.row.rights)"
                        auto-close
                    >
                        <q-list>
                            <q-item
                                v-for="option in accessGroupRightsList"
                                :key="option"
                                clickable
                                @click="() => onUpdateRights(props.row, option)"
                            >
                                <q-item-section>
                                    {{ getAccessRightDescription(option) }}
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-btn-dropdown>
                </q-td>
            </template>

            <template #body-cell-actions="props">
                <q-td :props="props">
                    <q-btn
                        flat
                        round
                        dense
                        icon="sym_o_delete"
                        color="red"
                        @click="() => onRemoveProject(props.row)"
                    />
                </q-td>
            </template>
        </q-table>
    </div>
</template>

<script setup lang="ts">
import type { ProjectDto } from '@kleinkram/api-dto/types/project/base-project.dto';
import { AccessGroupRights } from '@kleinkram/shared';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, QSelect, QTableColumn } from 'quasar';
import { accessGroupRightsList } from 'src/enums/access-group-rights-list';
import { useFilteredProjects } from 'src/hooks/query-hooks';
import { getAccessRightDescription } from 'src/services/generic';
import { addAccessGroupToProject } from 'src/services/mutations/access';
import { computed, ref, Ref } from 'vue';

const properties = defineProps<{
    accessGroupUuid: string;
}>();

const queryClient = useQueryClient();

interface SelectedProject {
    uuid: string;
    name: string;
    rights: AccessGroupRights;
}

const selectReference = ref<QSelect>();
const search = ref('');
const isSearchActive = ref(false);
const selectedSearchItem = ref(undefined);
const selectedProjects: Ref<SelectedProject[]> = ref([]);

const searchFilter = computed(() => ({
    name: search.value,
}));

const { data: foundProjects } = useFilteredProjects(
    100,
    0,
    'name',
    true,
    searchFilter,
);

const _foundProjects = computed(() =>
    foundProjects.value ? foundProjects.value.data : [],
);

const columns: QTableColumn<SelectedProject>[] = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        field: 'name',
    },
    {
        name: 'rights',
        required: true,
        label: 'Rights',
        align: 'left',
        field: 'rights',
    },
    {
        name: 'actions',
        required: true,
        label: '',
        align: 'center',
        field: (row: SelectedProject) => row.uuid,
    },
];

const enableSearchMode = (event?: Event): void => {
    isSearchActive.value = true;
    event?.stopPropagation();
};

const handleSearchFilter = (
    value: string,
    update: (function_: () => void) => void,
): void => {
    search.value = value;
    enableSearchMode();
    update(() => ({}));
};

const getExistingRight = (uuid: string): AccessGroupRights | undefined => {
    return selectedProjects.value.find((p) => p.uuid === uuid)?.rights;
};

const handleAddProject = (project: ProjectDto): void => {
    if (getExistingRight(project.uuid) !== undefined) return;

    selectReference.value?.updateInputValue('', true);
    selectReference.value?.hidePopup();

    isSearchActive.value = false;
    selectedSearchItem.value = undefined;
    search.value = '';

    selectedProjects.value.push({
        uuid: project.uuid,
        name: project.name,
        rights: AccessGroupRights.READ,
    });
};

const onUpdateRights = (
    project: SelectedProject,
    newRight: AccessGroupRights,
): void => {
    const p = selectedProjects.value.find((p) => p.uuid === project.uuid);
    if (p) {
        p.rights = newRight;
    }
};

const onRemoveProject = (project: SelectedProject): void => {
    selectedProjects.value = selectedProjects.value.filter(
        (p) => p.uuid !== project.uuid,
    );
};

const { mutate } = useMutation({
    mutationFn: () => {
        return Promise.all(
            selectedProjects.value.map(async (project) => {
                return addAccessGroupToProject(
                    project.uuid,
                    properties.accessGroupUuid,
                    project.rights,
                );
            }),
        );
    },
    onSuccess: async () => {
        Notify.create({
            message: 'Access group added to project(s)',
            color: 'positive',
            position: 'bottom',
        });
        await queryClient.invalidateQueries({
            queryKey: ['AccessGroup', properties.accessGroupUuid],
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
