<template>
    <q-card-section class="q-pa-md">
        <p>
            Please confirm by entering the mission name:
            <b>{{ mission.name }}</b>
        </p>
        <q-input
            v-model="missionNameCheck"
            outlined
            placeholder="Confirm Mission Name"
            autofocus
        />
    </q-card-section>
</template>
<script setup lang="ts">
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import ROUTES from 'src/router/routes';
import { getErrorMessage } from 'src/services/error-handling';
import { deleteMission } from 'src/services/mutations/mission';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const missionNameCheck = ref('');
const client = useQueryClient();
const properties = defineProps<{
    mission: MissionWithFilesDto;
}>();

const route = useRoute();
const router = useRouter();

const deleteMissionAction = async (): Promise<void> => {
    if (missionNameCheck.value === properties.mission.name) {
        await deleteMission(properties.mission)
            .then(async () => {
                await client.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'missions' ||
                        (query.queryKey[0] === 'mission' &&
                            query.queryKey[1] === properties.mission.uuid),
                });

                await client.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'projects' ||
                        (query.queryKey[0] === 'project' &&
                            query.queryKey[1] ===
                                properties.mission.project.uuid),
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
                            projectUuid: route.params.projectUuid,
                        },
                    });
                }
            })
            .catch((error: unknown) => {
                // the server says why, e.g. that the mission still has files
                // or running actions
                const errorMessage = getErrorMessage(error);

                Notify.create({
                    message: `Error deleting mission: ${errorMessage}`,
                    color: 'negative',
                    position: 'bottom',
                });
            });
    }
};

defineExpose({
    deleteMissionAction,

    // eslint-disable-next-line @typescript-eslint/naming-convention
    mission_name_check: missionNameCheck,
});
</script>
<style scoped></style>
