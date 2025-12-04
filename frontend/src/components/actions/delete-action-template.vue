<template>
    <q-card-section class="q-pa-md">
        <p v-if="isArchiving">
            This action template has
            <b>{{ template.executionCount }}</b> executions. It cannot be
            deleted, but it will be <b>archived</b> instead.
        </p>
        <p v-else>
            This action template has no executions and will be
            <b>permanently deleted</b>.
        </p>

        <p>
            Please confirm by entering the Action Template name:
            <b>{{ template.name }}</b>
        </p>
        <q-input
            v-model="nameCheck"
            outlined
            placeholder="Confirm Template Name"
            autofocus
            dense
        />
    </q-card-section>
</template>

<script setup lang="ts">
import { ActionTemplateDto } from '@kleinkram/api-dto/types/actions/action-template.dto';
import { Notify } from 'quasar';
import { useDeleteTemplate } from 'src/composables/use-action-mutations';
import { computed, ref } from 'vue';

const props = defineProps<{
    template: ActionTemplateDto;
}>();

const nameCheck = ref('');
const { mutateAsync: removeTemplate } = useDeleteTemplate();

const isArchiving = computed(() => props.template.executionCount > 0);

async function executeAction(): Promise<void> {
    if (nameCheck.value !== props.template.name) {
        return;
    }

    try {
        await removeTemplate(props.template.uuid);

        Notify.create({
            message: isArchiving.value
                ? 'Action template archived'
                : 'Action template deleted',
            color: 'positive',
            timeout: 2000,
            position: 'bottom',
        });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : 'Unknown error occurred';
        Notify.create({
            message: `Error: ${message}`,
            color: 'negative',
            position: 'bottom',
        });
    }
}

defineExpose({
    executeAction,
    nameCheck,
    isArchiving,
});
</script>
