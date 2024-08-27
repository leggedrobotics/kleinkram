<template>
    <q-card-section class="q-pa-md">
        <h5>Delete Mission</h5>
        <p>Please confirm by entering the Mission name: {{ mission.name }}</p>
        <q-input v-model="missionnamecheck" label="Mission Name" />
        <div class="q-mt-md row">
            <div class="col-10" />
            <div class="col-2">
                <q-btn
                    label="DELETE"
                    color="red"
                    @click="_deleteMission"
                    :disable="missionnamecheck !== mission.name"
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

const missionnamecheck = ref('');
const client = useQueryClient();
const props = defineProps<{
    mission: Mission;
}>();
const emit = defineEmits(['deleted']);

async function _deleteMission() {
    if (missionnamecheck.value === props.mission.name) {
        await deleteMission(props.mission)
            .then(() => {
                client.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'missions' ||
                        (query.queryKey[0] === 'mission' &&
                            query.queryKey[1] === props.mission.uuid),
                });
                Notify.create({
                    message: 'Mission deleted',
                    color: 'positive',
                    timeout: 2000,
                    position: 'bottom',
                });
                emit('deleted');
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
</script>
<style scoped></style>
