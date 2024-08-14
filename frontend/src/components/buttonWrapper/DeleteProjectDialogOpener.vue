<template>
    <div @click="deleteProjectDialog">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { deleteProject } from 'src/services/mutations/project';
import { Notify, useQuasar } from 'quasar';
import { useQueryClient } from '@tanstack/vue-query';
import { useProjectQuery } from 'src/hooks/customQueryHooks';
import { Ref, ref } from 'vue';
import { QueryURLHandler } from 'src/services/URLHandler';
import { useRouter } from 'vue-router';

const { project_uuid } = defineProps({
    project_uuid: String,
});

const $q = useQuasar();
const $emit = defineEmits(['onSuccessfulDelete']);

const router = useRouter();

const handler: Ref<QueryURLHandler> = ref(
    new QueryURLHandler(),
) as unknown as Ref<QueryURLHandler>;
handler.value.setRouter(router);

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

                Notify.create({
                    message: 'Project deleted successfully!',
                    color: 'positive',
                });

                handler.value.setProjectUUID('');

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
