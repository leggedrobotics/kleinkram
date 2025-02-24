<template>
    <q-card-section class="q-pa-md">
        <p>
            Please confirm by entering the Project name:
            <b>{{ project.name }}</b>
        </p>
        <q-input
            v-model="projectNameCheck"
            outlined
            placeholder="Confirm Project Name"
            autofocus
        />
    </q-card-section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify, QInput } from 'quasar';
import { deleteProject } from 'src/services/mutations/project';
import { useHandler } from '../hooks/query-hooks';

import { ProjectWithCreator } from '@api/types/project/project-with-creator.dto';

const projectNameCheck = ref('');
const client = useQueryClient();
const { project } = defineProps<{
    project: ProjectWithCreator;
}>();

const handler = useHandler();

async function deleteProjectAction(): Promise<void> {
    if (projectNameCheck.value === project.name) {
        await deleteProject(project.uuid)
            .then(async () => {
                await client.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'projects' ||
                        (query.queryKey[0] === 'project' &&
                            query.queryKey[1] === project.uuid),
                });
                Notify.create({
                    message: 'Project deleted',
                    color: 'positive',
                    timeout: 2000,
                    position: 'bottom',
                });

                handler.value.setProjectUUID('');
            })
            .catch((error: unknown) => {
                let errorMessage = '';
                errorMessage =
                    error instanceof Error
                        ? error.message
                        : ((
                              error as {
                                  response?: { data?: { message?: string } };
                              }
                          ).response?.data?.message ?? 'Unknown error');

                Notify.create({
                    message: `Error deleting project: ${errorMessage}`,
                    color: 'negative',
                    position: 'bottom',
                });
            });
    }
}

defineExpose({
    deleteProjectAction,
    project_name_check: projectNameCheck,
});
</script>
