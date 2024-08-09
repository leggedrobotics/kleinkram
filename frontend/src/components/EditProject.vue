<template>
    <h4>Edit Project</h4>
    <div>
        <q-input
            ref="projectNameInput"
            v-model="projectName"
            outlined
            autofocus
            style="padding-bottom: 30px"
            label="Project Name *"
            :rules="[
                (val) => !!val || 'A project name cannot be empty!',
                (val) =>
                    !invalidProjectNames.includes(val) ||
                    'A project with that name already exists!',
            ]"
            @update:model-value="
                () => {
                    hasValidInput =
                        !!projectName &&
                        !!projectDescription &&
                        !invalidProjectNames.includes(projectName);
                }
            "
        />

        <q-input
            v-model="projectDescription"
            type="textarea"
            outlined
            style="padding-bottom: 10px"
            label="Project Description *"
            :rules="[(val) => !!val || 'Project Description is required']"
            @update:model-value="
                hasValidInput = !!projectName && !!projectDescription
            "
        />
        <div class="flex justify-end">
            <q-btn
                v-if="project"
                label="Save"
                color="primary"
                @click="save"
                icon="sym_o_save"
            />
        </div>
    </div>
</template>
<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, Ref, ref, watch } from 'vue';
import { Notify, QInput, useQuasar } from 'quasar';
import { Project } from 'src/types/Project';
import AccessRightsDialog from 'src/dialogs/AccessRightsDialog.vue';
import { getProject } from 'src/services/queries/project';
import { deleteProject, updateProject } from 'src/services/mutations/project';

const props = defineProps<{
    project_uuid: string;
}>();
const emit = defineEmits(['project-deleted']);
const queryClient = useQueryClient();

const projectName = ref('');
const projectDescription = ref('');
const hasValidInput = ref(false);

const invalidProjectNames: Ref<string[]> = ref([]);

const key = computed(() => ['project', props.project_uuid]);
const projectResponse = useQuery<Project>({
    queryKey: key,
    queryFn: () => getProject(props.project_uuid),
});
const project = computed(() => projectResponse.data.value);
watch(
    () => project.value,
    (newVale: Project | undefined) => {
        if (newVale) {
            projectName.value = newVale?.name;
            projectDescription.value = newVale?.description;
        }
    },
    { immediate: true },
);
async function save() {
    if (
        projectName.value === project.value?.name &&
        projectDescription.value === project.value?.description
    ) {
        return;
    }
    if (
        project.value?.uuid &&
        project.value?.name &&
        project.value?.description
    ) {
        const noti = Notify.create({
            group: false,
            message: `Updating project ${project.value?.name}`,
            color: 'info',
            spinner: true,
            timeout: 0,
            position: 'top-right',
        });
        try {
            await updateProject(
                project.value?.uuid,
                projectName.value.trim(),
                projectDescription.value,
            );
            noti({
                message: `Project ${project.value?.name} updated`,
                color: 'positive',
                spinner: false,
                timeout: 3000,
            });
            const cache = queryClient.getQueryCache();
            const filtered = cache
                .getAll()
                .filter(
                    (query) =>
                        query.queryKey[0] === 'projects' ||
                        query.queryKey[0] === 'project',
                );
            filtered.forEach((query) => {
                queryClient.invalidateQueries({ queryKey: query.queryKey });
            });
        } catch (e) {
            if (
                e.response.data.message ===
                'Project with that name already exists'
            ) {
                invalidProjectNames.value.push(projectName.value);
                noti({
                    message: `Error updating project ${project.value?.name}: Project with that name already exists`,
                    color: 'negative',
                    spinner: false,
                    timeout: 3000,
                });
            } else {
                noti({
                    message: `Error updating project ${project.value?.name}`,
                    color: 'negative',
                    spinner: false,
                    timeout: 3000,
                });
            }
        }
    }
}
</script>
<style scoped></style>
