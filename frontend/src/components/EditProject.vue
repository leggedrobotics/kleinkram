<template>
    <div>
        <label for="projectName">Project Name *</label>
        <q-input
            ref="projectNameInput"
            v-model="projectName"
            name="projectName"
            outlined
            autofocus
            style="padding-bottom: 30px"
            placeholder="Name..."
            :rules="[
                (val) => !!val || 'A project name cannot be empty!',
                (val) =>
                    val.length <= 20 ||
                    'Project name must be less than 20 characters long!',
                (val) =>
                    val.length >= 3 ||
                    'Project name must be at least 3 characters long!',
                (val) =>
                    /^[a-zA-Z0-9-_]*$/.test(val) ||
                    `Project names can only contain letters, numbers, hyphens, and underscores! It contains: ${
                        val
                            .match(/[^a-zA-Z0-9-_]/g)
                            .map((c: string) => `'${c}'`)
                            .join(', ') || ''
                    }`,
                (val) =>
                    !invalidProjectNames.includes(val) ||
                    'A project with that name already exists!',
            ]"
            @update:model-value="
                () => {
                    hasValidInput = !!projectName && !!projectDescription;
                }
            "
        />

        <label for="projectDescription">Project Description *</label>
        <q-input
            v-model="projectDescription"
            autofocus
            name="projectDescription"
            type="textarea"
            outlined
            placeholder="Description..."
            :rules="[(val) => !!val || 'Project Description is required']"
            @update:model-value="
                hasValidInput = !!projectName && !!projectDescription
            "
        />
    </div>
</template>
<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { computed, Ref, ref, watch } from 'vue';
import { Notify, QInput } from 'quasar';
import { updateProject } from 'src/services/mutations/project';
import { ProjectDto } from '@api/types/Project.dto';
import { useProjectQuery } from '../hooks/customQueryHooks';

const props = defineProps<{
    project_uuid: string;
}>();
const queryClient = useQueryClient();

const projectName = ref('');
const projectDescription = ref('');
const hasValidInput = ref(false);

const invalidProjectNames: Ref<string[]> = ref([]);

const projectResponse = useProjectQuery(props.project_uuid);

const project = computed(() => projectResponse.data.value);
watch(
    () => project.value,
    (newVale: ProjectDto | undefined) => {
        if (newVale) {
            projectName.value = newVale.name;
            projectDescription.value = newVale.description;
        }
    },
    { immediate: true },
);

async function save_changes(): Promise<void> {
    // resolve immediately if no changes
    if (
        projectName.value === project.value?.name &&
        projectDescription.value === project.value.description
    )
        return Promise.resolve();

    // validate input
    if (!project.value?.uuid) {
        return Promise.reject(new Error('Project UUID is not valid'));
    }
    if (!project.value.name) {
        return Promise.reject(new Error('Project name is not valid'));
    }
    if (!project.value.description) {
        return Promise.reject(new Error('Project description is not valid'));
    }

    await updateProject(
        project.value.uuid,
        projectName.value.trim(),
        projectDescription.value,
    ).catch((error: unknown) => {
        if (error.response.data.message.includes('Project')) {
            Notify.create({
                message: `Error updating project: ${error.response.data.message}`,
                color: 'negative',
                position: 'bottom',
                timeout: 5000,
            });
        } else {
            Notify.create({
                message: `Error updating project: ${error.response.data.message}`,
                color: 'negative',
                position: 'bottom',
                timeout: 5000,
            });
        }

        return Promise.reject(error as Error);
    });

    const cache = queryClient.getQueryCache();
    const filtered = cache
        .getAll()
        .filter(
            (query) =>
                query.queryKey[0] === 'projects' ||
                query.queryKey[0] === 'project',
        );
    await Promise.all(
        filtered.map((query) =>
            queryClient.invalidateQueries({ queryKey: query.queryKey }),
        ),
    );

    Notify.create({
        message: 'Project updated successfully',
        color: 'positive',
        position: 'bottom',
        timeout: 2000,
    });
}

defineExpose({
    save_changes,
});
</script>
<style scoped></style>
