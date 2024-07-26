<template>
    <div class="row justify-start">
        <div class="col-2" style="margin-right: 15px">
            <q-input
                v-if="project"
                v-model="project.name"
                label="Name"
                outlined
                dense
                clearable
                required
            />
        </div>
        <div class="col-2" style="margin-right: 15px">
            <q-input
                v-if="project"
                v-model="project.description"
                label="Description"
                type="textarea"
                autogrow
                :rows="4"
                outlined
                dense
                clearable
            />
        </div>
        <div class="col-1" style="margin-right: 15px">
            <q-btn
                v-if="project"
                label="Save"
                color="primary"
                @click="save"
                icon="save"
            />
        </div>
        <div class="col-2">
            <q-btn
                v-if="project"
                label="Manage Access Rights"
                color="orange"
                @click="openAccessRightsModal"
                icon="lock"
            />
        </div>
        <div class="col-1" style="margin-right: 15px">
            <q-btn
                v-if="project"
                label="Delete"
                color="red"
                @click="_deleteProject"
                icon="delete"
                :disable="project.missions.length > 0"
            >
                <q-tooltip class="bg-accent"
                    >Only projects without missions can be deleted</q-tooltip
                >
            </q-btn>
        </div>
    </div>
</template>
<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { deleteProject, updateProject } from 'src/services/mutations';
import { ref, watch } from 'vue';
import { Notify, useQuasar } from 'quasar';
import { Project } from 'src/types/Project';
import AccessRightsDialog from 'components/AccessRightsDialog.vue';
import { getProject } from 'src/services/queries/project';

const props = defineProps<{
    project_uuid: string;
}>();
const emit = defineEmits(['project-deleted']);
const queryClient = useQueryClient();
const $q = useQuasar();

const projectResponse = useQuery<Project>({
    queryKey: ['project', props.project_uuid],
    queryFn: () => getProject(props.project_uuid),
    enabled: !!props.project_uuid,
});
const project = ref<Project | undefined>(undefined);
watch(
    () => projectResponse.data,
    (newValue) => {
        if (newValue) {
            project.value = newValue.value?.clone();
        }
    },
    { deep: true },
);

async function save() {
    if (
        project.value?.uuid &&
        project.value?.name &&
        project.value?.description
    ) {
        try {
            project.value = await updateProject(
                project.value?.uuid,
                project.value?.name,
                project.value?.description,
            );
            Notify.create({
                message: `Project ${project.value?.name} updated`,
                color: 'positive',
                spinner: false,
                timeout: 3000,
                position: 'top-right',
            });
            const cache = queryClient.getQueryCache();
            const filtered = cache
                .getAll()
                .filter((query) => query.queryKey[0] === 'projects');
            filtered.forEach((query) => {
                queryClient.invalidateQueries(query.queryKey);
            });
        } catch (e) {
            Notify.create({
                message: `Error updating project ${project.value?.name}`,
                color: 'negative',
                spinner: false,
                timeout: 3000,
                position: 'top-right',
            });
        }
    }
}

async function _deleteProject() {
    try {
        await deleteProject(props.project_uuid);
        Notify.create({
            message: `Project ${project.value?.name} deleted`,
            color: 'positive',
            spinner: false,
            timeout: 3000,
            position: 'top-right',
        });
    } catch (e) {
        Notify.create({
            message: `Error deleting project ${project.value?.name}`,
            color: 'negative',
            spinner: false,
            timeout: 3000,
            position: 'top-right',
        });
    }
    const cache = queryClient.getQueryCache();
    const filtered = cache
        .getAll()
        .filter((query) => query.queryKey[0] === 'projects');
    filtered.forEach((query) => {
        queryClient.invalidateQueries(query.queryKey);
    });
    emit('project-deleted');
}

function openAccessRightsModal() {
    $q.dialog({
        component: AccessRightsDialog,
        componentProps: {
            project_uuid: props.project_uuid,
        },
    });
}
</script>
<style scoped></style>
