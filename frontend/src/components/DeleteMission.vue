<template>
    <q-card-section class="q-pa-md">
        <p>
            Please confirm by entering the mission name:
            <b>{{ mission.name }}</b>
        </p>
        <q-input
            v-model="mission_name_check"
            outlined
            placeholder="Confirm Mission Name"
            autofocus
        />
    </q-card-section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { deleteMission } from 'src/services/mutations/mission';
import ROUTES from 'src/router/routes';
import { useRoute, useRouter } from 'vue-router';
import { MissionDto } from '@api/types/Mission.dto';

const mission_name_check = ref('');
const client = useQueryClient();
const props = defineProps<{
    mission: MissionDto;
}>();

const route = useRoute();
const router = useRouter();

async function deleteMissionAction() {
    if (mission_name_check.value === props.mission.name) {
        await deleteMission(props.mission)
            .then(async () => {
                await client.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'missions' ||
                        (query.queryKey[0] === 'mission' &&
                            query.queryKey[1] === props.mission.uuid),
                });

                await client.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'projects' ||
                        (query.queryKey[0] === 'project' &&
                            query.queryKey[1] === props.mission.project.uuid),
                });

                Notify.create({
                    message: 'Mission deleted',
                    color: 'positive',
                    timeout: 2000,
                    position: 'bottom',
                });

                if (route.name === ROUTES.FILES.routeName) {
                    await router.push({
                        name: ROUTES.MISSIONS.routeName,
                        params: {
                            project_uuid: route.params.project_uuid,
                        },
                    });
                }
            })
            .catch((e) => {
                Notify.create({
                    message: `Error deleting mission: ${e.response.data.message}`,
                    color: 'negative',
                    position: 'bottom',
                });
            });
    }
}

defineExpose({
    deleteMissionAction,
    mission_name_check,
});
</script>
<style scoped></style>
