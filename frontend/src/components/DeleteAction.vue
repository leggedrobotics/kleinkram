<template>
    <q-card-section class="q-pa-md">
        <p>
            Please confirm by entering the Action template name:
            <b>{{ props.action.template.name }}</b>
        </p>
        <q-input
            v-model="actionNameCheck"
            outlined
            placeholder="Confirm Action Name"
            autofocus
        />
    </q-card-section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { deleteAction } from 'src/services/mutations/action';
import { ActionDto } from '@api/types/Actions.dto';

const actionNameCheck = ref('');
const client = useQueryClient();

async function deleteActionAction() {
    if (actionNameCheck.value === props.action.template.name) {
        await deleteAction(props.action)
            .then(async () => {
                await client.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'action_mission',
                });
                Notify.create({
                    message: 'Action deleted',
                    color: 'positive',
                    timeout: 2000,
                    position: 'bottom',
                });
            })
            .catch((error) => {
                Notify.create({
                    message: `Error deleting Action: ${error.response.data.message}`,
                    color: 'negative',
                    position: 'bottom',
                });
            });
    }
}

const props = defineProps<{
    action: ActionDto;
}>();

defineExpose({
    deleteActionAction,
    action_name_check: actionNameCheck,
});
</script>
<style scoped></style>
