<template>
    <div v-if="selectedProjects.length > 0" class="row-grid">
        <div
            v-for="(project, index) in selectedProjects"
            :key="project.uuid"
            class="row-grid__row"
        >
            <div v-if="index > 0" class="row-grid__separator" />
            <div class="row-grid__name">
                <div class="row-grid__label">{{ project.name }}</div>
                <div class="row-grid__type">Project</div>
            </div>

            <div class="row-grid__setting">
                <q-select
                    no-error-icon
                    :model-value="project.rights"
                    :options="rightOptions"
                    :aria-label="`Rights on ${project.name}`"
                    emit-value
                    map-options
                    outlined
                    dense
                    color="button-primary"
                    hide-bottom-space
                    @update:model-value="
                        (right: AccessGroupRights) =>
                            onUpdateRights(project, right)
                    "
                />
            </div>

            <div class="row-grid__action">
                <q-btn
                    flat
                    round
                    dense
                    icon="sym_o_delete"
                    class="row-grid__remove"
                    :aria-label="`Remove ${project.name}`"
                    @click="() => onRemoveProject(project)"
                />
            </div>
        </div>
    </div>

    <q-btn
        flat
        no-caps
        dense
        icon="sym_o_add"
        label="Add project"
        class="text-link-primary"
        :class="{ 'add-button--below': selectedProjects.length > 0 }"
    >
        <q-menu v-model="menuOpen" style="min-width: 320px" @hide="clearSearch">
            <div class="add-menu__search">
                <q-input
                    v-model="search"
                    no-error-icon
                    dense
                    outlined
                    autofocus
                    debounce="300"
                    color="button-primary"
                    aria-label="Search projects"
                    placeholder="Search projects"
                    autocomplete="off"
                    @keydown.enter.prevent="addFirstResult"
                >
                    <template #prepend>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>
            </div>
            <q-list class="add-menu__list">
                <q-item v-if="_foundProjects.length === 0">
                    <q-item-section class="text-secondary">
                        No results
                    </q-item-section>
                </q-item>
                <q-item
                    v-for="opt in _foundProjects"
                    :key="opt.uuid"
                    clickable
                    :disable="getExistingRight(opt.uuid) !== undefined"
                    @click="() => handleAddProject(opt)"
                >
                    <q-item-section avatar>
                        <q-icon name="sym_o_box" class="text-secondary" />
                    </q-item-section>

                    <q-item-section>
                        <q-item-label>{{ opt.name }}</q-item-label>
                    </q-item-section>

                    <q-item-section
                        v-if="getExistingRight(opt.uuid) !== undefined"
                        side
                    >
                        <q-badge
                            color="grey-3"
                            text-color="grey-9"
                            :label="
                                getAccessRightDescription(
                                    getExistingRight(opt.uuid)!,
                                )
                            "
                        />
                    </q-item-section>
                </q-item>
            </q-list>
        </q-menu>
    </q-btn>
</template>

<script setup lang="ts">
import type { ProjectDto } from '@kleinkram/api-dto/types/project/base-project.dto';
import { AccessGroupRights } from '@kleinkram/shared';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { accessGroupRightsList } from 'src/enums/access-group-rights-list';
import { useFilteredProjects } from 'src/hooks/query-hooks';
import { getAccessRightDescription } from 'src/services/generic';
import { addAccessGroupToProject } from 'src/services/mutations/access';
import { computed, ref, Ref, watch } from 'vue';

const properties = defineProps<{
    accessGroupUuid: string;
}>();

const queryClient = useQueryClient();

interface SelectedProject {
    uuid: string;
    name: string;
    rights: AccessGroupRights;
}

const menuOpen = ref(false);
const search = ref('');
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

const rightOptions = accessGroupRightsList.map((option) => ({
    label: getAccessRightDescription(option),
    value: option,
}));

const clearSearch = (): void => {
    search.value = '';
};

const getExistingRight = (uuid: string): AccessGroupRights | undefined => {
    return selectedProjects.value.find((p) => p.uuid === uuid)?.rights;
};

const handleAddProject = (project: ProjectDto): void => {
    if (getExistingRight(project.uuid) !== undefined) return;

    menuOpen.value = false;

    selectedProjects.value.push({
        uuid: project.uuid,
        name: project.name,
        rights: AccessGroupRights.READ,
    });
};

/** Enter in the search adds the first project that is not added yet */
const addFirstResult = (): void => {
    const first = _foundProjects.value.find(
        (project) => getExistingRight(project.uuid) === undefined,
    );
    if (first) handleAddProject(first);
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

const { mutateAsync } = useMutation({
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
        selectedProjects.value = [];
        Notify.create({
            message: 'Access group added to project(s)',
            color: 'positive',
            position: 'bottom',
        });
        await queryClient.invalidateQueries({
            queryKey: ['AccessGroup', properties.accessGroupUuid],
        });
    },
});

/** How many are selected, for the dialog's button */
const count = defineModel<number>('count', { default: 0 });
watch(
    () => selectedProjects.value.length,
    (length) => {
        count.value = length;
    },
    { immediate: true },
);

defineExpose({ mutateAsync });
</script>

<style scoped>
/* rows share their columns: name | rights | remove */
.row-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 112px 32px;
    gap: 8px 16px;
    align-items: center;
}

.row-grid__row {
    display: contents;
}

/* $border-subtle-00 */
.row-grid__separator {
    grid-column: 1 / -1;
    height: 1px;
    background: #e0e0e0;
}

.row-grid__name {
    min-width: 0;
    overflow-wrap: anywhere;
}

/* $text-primary */
.row-grid__label {
    color: #161616;
    font-size: 14px;
    line-height: 18px;
}

/* $text-secondary */
.row-grid__type {
    color: #525252;
    font-family: monospace;
    font-size: 11px;
    line-height: 16px;
    text-transform: uppercase;
}

.row-grid__setting {
    min-width: 0;
}

.row-grid__action {
    display: flex;
    justify-content: center;
}

/* $icon-secondary */
.row-grid__remove {
    color: #525252;
}

.add-button--below {
    margin-top: 8px;
}

.add-menu__search {
    padding: 8px;
}

.add-menu__list {
    max-height: 320px;
    overflow-y: auto;
}

@media (max-width: 599px) {
    .row-grid {
        grid-template-columns: minmax(0, 1fr) 32px;
    }

    .row-grid__name {
        grid-column: 1 / -1;
        margin-top: 8px;
    }
}
</style>
