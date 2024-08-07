<template>
    <q-btn color="red" outline icon="sym_o_delete" @click="deleteProjectDialog">
        <q-tooltip> Delete the Project </q-tooltip>
    </q-btn>
</template>

<script setup lang="ts">
import { deleteProject } from 'src/services/mutations/project';
import { Notify, useQuasar } from 'quasar';
import { useQueryClient } from '@tanstack/vue-query';
import { useProjectQuery } from 'src/hooks/customQueryHooks';
import { ref } from 'vue';

const { project_uuid } = defineProps({
    project_uuid: String,
});

const $q = useQuasar();
const $emit = defineEmits(['onSuccessfulDelete']);

const queryClient = useQueryClient();
const { data: project } = useProjectQuery(ref(project_uuid));

const deleteProjectDialog = () => {
    const project_uuid_val = project_uuid;
    if (!project_uuid_val) return;

    const dialog = $q.dialog({
        title: 'Delete Project ' + project.value?.name,
        message: 'Are you sure you want to delete this project?',
        ok: {
            label: 'Yes',
            color: 'negative',
        },
        cancel: {
            label: 'No',
            color: 'primary',
        },
    });

    dialog.onOk(() =>
        deleteProject(project_uuid_val)
            .then(async () => {
                // emit the event
                $emit('onSuccessfulDelete');

                // invalidate queries
                await queryClient.invalidateQueries({ queryKey: ['projects'] });
                await queryClient.invalidateQueries({
                    queryKey: ['project', project_uuid],
                });
            })
            .catch(() =>
                Notify.create({
                    message: 'Project deletion failed!',
                    color: 'negative',
                }),
            ),
    );
};
</script>
