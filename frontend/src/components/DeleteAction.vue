<template>
    <q-card-section class="q-pa-md">
        <p>
            Please confirm by entering the Action template name:
            <b>{{ props.action.template.name }}</b>
        </p>
        <q-input
            v-model="action_name_check"
            outlined
            placeholder="Confirm Action Name"
            autofocus
        />
    </q-card-section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { FileEntity } from 'src/types/FileEntity';
import { deleteFile } from 'src/services/mutations/file';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import ROUTES from 'src/router/routes';
import { Action } from 'src/types/Action';
import { deleteAction } from 'src/services/mutations/action';

const action_name_check = ref('');
const client = useQueryClient();

const route = useRoute();
const router = useRouter();

async function deleteActionAction() {
    if (action_name_check.value === props.action.template.name) {
        await deleteAction(props.action)
            .then(() => {
                client.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'action_mission',
                });
                Notify.create({
                    message: 'Action deleted',
                    color: 'positive',
                    timeout: 2000,
                    position: 'bottom',
                });

                // // Redirect to missions page if we are on the file page
                // if (route.name === ROUTES.FILE.routeName) {
                //     router.push({
                //         name: ROUTES.FILES.routeName,
                //         params: {
                //             project_uuid: route.params.project_uuid,
                //             mission_uuid: route.params.mission_uuid,
                //         },
                //     });
                // }
            })
            .catch((e) => {
                Notify.create({
                    message: `Error deleting Action: ${e.response.data.message}`,
                    color: 'negative',
                    position: 'bottom',
                });
            });
    }
}

const props = defineProps<{
    action: Action;
}>();

defineExpose({
    deleteActionAction,
    action_name_check,
});
</script>
<style scoped></style>
