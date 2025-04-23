<template>
    <div v-if="project">
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
            @update:model-value="onProjectNameUpdate"
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
            @update:model-value="onProjectNameUpdate"
        />

        <div class="flex column">
            <label for="autoConvert"
                >Enable Auto-Convert to mcap format *</label
            >
            <q-toggle
                v-model="autoConvert"
                name="autoConvert"
                label="auto-convert to mcap"
                color="primary"
                dense
                style="margin: 10px 0"
            />
            <span class="text-grey-8">
                Enable Auto-Convert to mcap format has some known limitations.
                Please refer to
                https://github.com/leggedrobotics/kleinkram/issues/1250.
            </span>
        </div>
    </div>
    <div v-else>
        <q-spinner />
    </div>
</template>
<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { computed, Ref, ref, watch } from 'vue';
import { Notify, QInput } from 'quasar';
import { updateProject } from 'src/services/mutations/project';
import { useProjectQuery } from 'src/hooks/query-hooks';
import { ProjectWithRequiredTags } from '@api/types/project/project-with-required-tags';

const { projectUuid } = defineProps<{
    projectUuid: string;
}>();
const queryClient = useQueryClient();

const projectName = ref('');
const autoConvert = ref(true);
const projectDescription = ref('');
const hasValidInput = ref(false);

const invalidProjectNames: Ref<string[]> = ref([]);

const { data: project } = useProjectQuery(computed(() => projectUuid));

watch(
    () => project.value,
    (newVale: ProjectWithRequiredTags | undefined) => {
        if (newVale) {
            projectName.value = newVale.name;
            projectDescription.value = newVale.description;
            autoConvert.value = newVale.autoConvert;
        }
    },
    { immediate: true },
);

async function save_changes(): Promise<void> {
    // resolve immediately if no changes
    if (
        projectName.value === project.value?.name &&
        projectDescription.value === project.value.description &&
        autoConvert.value === project.value.autoConvert
    )
        return;

    // validate input
    if (!project.value?.uuid) {
        throw new Error('Project UUID is not valid');
    }
    if (!project.value.name) {
        throw new Error('Project name is not valid');
    }
    if (!project.value.description) {
        throw new Error('Project description is not valid');
    }

    await updateProject(
        project.value.uuid,
        projectName.value.trim(),
        projectDescription.value,
        autoConvert.value,
    ).catch((error: unknown) => {
        let errorMessage = '';
        errorMessage =
            error instanceof Error
                ? error.message
                : ((error as { response?: { data?: { message?: string } } })
                      .response?.data?.message ?? 'Unknown error');

        if (errorMessage.includes('Project')) {
            Notify.create({
                message: `Error updating project: ${errorMessage}`,
                color: 'negative',
                position: 'bottom',
                timeout: 5000,
            });
        } else {
            Notify.create({
                message: `Error updating project: ${errorMessage}`,
                color: 'negative',
                position: 'bottom',
                timeout: 5000,
            });
        }

        throw error as Error;
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

const onProjectNameUpdate = () => {
    hasValidInput.value = !!projectName.value && !!projectDescription.value;
};
</script>
<style scoped></style>
