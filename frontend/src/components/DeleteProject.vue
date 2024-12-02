<template>
    <q-card-section class="q-pa-md">
        <p>
            Please confirm by entering the Project name:
            <b>{{ project.name }}</b>
        </p>
        <q-input
            v-model="project_name_check"
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
import { useHandler } from 'src/hooks/customQueryHooks';
import { BaseProjectDto } from '@api/types/Project.dto';

const project_name_check = ref('');
const client = useQueryClient();
const { project } = defineProps<{
    project: BaseProjectDto;
}>();

const handler = useHandler();

async function deleteProjectAction() {
    if (project_name_check.value === project.name) {
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
            .catch((e) => {
                Notify.create({
                    message: `Error deleting project: ${e.response.data.message}`,
                    color: 'negative',
                    position: 'bottom',
                });
            });
    }
}

defineExpose({
    deleteProjectAction,
    project_name_check,
});
</script>
