<template>
    <q-card-section class="q-pa-md">
        <h5>Delete Project</h5>
        <p>Please confirm by entering the Project name: {{ project.name }}</p>
        <q-input v-model="project_name_check" label="Mission Name" />
        <div class="q-mt-md row">
            <div class="col-10" />
            <div class="col-2">
                <q-btn
                    label="DELETE"
                    color="red"
                    @click="_deleteProject"
                    :disable="project_name_check !== project.name"
                />
            </div>
        </div>
    </q-card-section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { Mission } from 'src/types/Mission';
import { deleteMission } from 'src/services/mutations/mission';
import { Project } from 'src/types/Project';
import { deleteProject } from 'src/services/mutations/project';
import { useHandler } from 'src/hooks/customQueryHooks';

const project_name_check = ref('');
const client = useQueryClient();
const props = defineProps<{
    project: Project;
}>();
const emit = defineEmits(['deleted']);

const handler = useHandler();

async function _deleteProject() {
    if (project_name_check.value === props.project.name) {
        await deleteProject(props.project.uuid)
            .then(() => {
                client.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'projects' ||
                        (query.queryKey[0] === 'project' &&
                            query.queryKey[1] === props.project.uuid),
                });
                Notify.create({
                    message: 'Project deleted',
                    color: 'positive',
                    timeout: 2000,
                    position: 'bottom',
                });

                handler.value.setProjectUUID('');
                emit('deleted');
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
</script>
