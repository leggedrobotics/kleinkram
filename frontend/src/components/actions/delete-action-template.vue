<template>
    <q-card-section v-if="isBlocked" class="q-pa-md">
        <q-banner dense rounded class="bg-orange-1 text-orange-10">
            Used by <b>{{ template.triggerCount }}</b>
            {{ template.triggerCount === 1 ? 'trigger' : 'triggers' }}. Delete
            or change {{ template.triggerCount === 1 ? 'it' : 'them' }} first.
        </q-banner>
    </q-card-section>
    <q-card-section v-else class="q-pa-md">
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
import type { ActionTemplateDto } from '@kleinkram/api-dto/types/actions/action-template.dto';
import { Notify } from 'quasar';
import { useDeleteTemplate } from 'src/composables/use-action-mutations';
import { getErrorMessage } from 'src/services/error-handling';
import { computed, ref } from 'vue';

const props = defineProps<{
    template: ActionTemplateDto;
}>();

const nameCheck = ref('');
const { mutateAsync: removeTemplate } = useDeleteTemplate();

const isArchiving = computed(() => props.template.executionCount > 0);
// triggers keep running a template, so it can't go away while one uses it
const isBlocked = computed(() => props.template.triggerCount > 0);

async function executeAction(): Promise<void> {
    if (isBlocked.value || nameCheck.value !== props.template.name) {
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
        Notify.create({
            message: `Failed to delete template: ${getErrorMessage(error)}`,
            color: 'negative',
            position: 'bottom',
        });
    }
}

defineExpose({
    executeAction,
    nameCheck,
    isArchiving,
    isBlocked,
});
</script>
