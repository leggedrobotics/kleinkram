<template>
    <q-card-section class="q-pa-md">
        <p>
            Please confirm by entering the Action template name:
            <b>{{ action.template.name }}</b>
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
import type { ActionDto } from '@kleinkram/api-dto/types/actions/action.dto';
import { Notify } from 'quasar';
import { useDeleteAction } from 'src/composables/use-action-mutations';
import { ref } from 'vue';

const props = defineProps<{
    action: ActionDto;
}>();

const actionNameCheck = ref('');

const { mutateAsync: removeAction } = useDeleteAction();

async function deleteActionAction(): Promise<void> {
    if (actionNameCheck.value !== props.action.template.name) {
        return;
    }

    try {
        await removeAction(props.action.uuid);

        Notify.create({
            message: 'Action deleted',
            color: 'positive',
            timeout: 2000,
            position: 'bottom',
        });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : 'Unknown error occurred';
        Notify.create({
            message: `Error deleting Action: ${message}`,
            color: 'negative',
            position: 'bottom',
        });
    }
}

defineExpose({
    deleteActionAction,
    action_name_check: actionNameCheck,
});
</script>

<style scoped></style>
