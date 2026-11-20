<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="deleting"
        size="sm"
        :submit-disabled="!confirmed || deleting"
        @submit="deleteMissionAction"
    >
        <template #title>Delete Mission</template>
        <template #content>
            <template v-if="mission">
                <label :for="inputId" class="confirm-label">
                    Type <b>{{ mission.name }}</b> to confirm. This can't be
                    undone.
                </label>
                <q-input
                    v-model="missionNameCheck"
                    no-error-icon
                    :for="inputId"
                    outlined
                    dense
                    autofocus
                    autocomplete="off"
                />
            </template>
            <q-skeleton v-else height="64px" />
        </template>

        <template #actions>
            <span class="disabled-reason">
                <q-btn
                    flat
                    no-caps
                    :disable="!confirmed"
                    :loading="deleting"
                    label="Delete Mission"
                    class="bg-button-danger"
                    @click="deleteMissionAction"
                />
                <q-tooltip v-if="!confirmed"
                    >Type the name to confirm</q-tooltip
                >
            </span>
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useMission } from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { getErrorMessage } from 'src/services/error-handling';
import { deleteMission } from 'src/services/mutations/mission';
import { computed, ref, useId } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { missionUuid } = defineProps<{
    missionUuid: string;
}>();

const { data: mission } = useMission(computed(() => missionUuid));
const client = useQueryClient();
const route = useRoute();
const router = useRouter();

const inputId = `delete-mission-${useId()}`;
const missionNameCheck = ref('');
const deleting = ref(false);
const errorMessage = ref('');
const confirmed = computed(
    () => !!mission.value && missionNameCheck.value === mission.value.name,
);

async function deleteMissionAction(): Promise<void> {
    if (!mission.value || !confirmed.value || deleting.value) return;
    const deleted = mission.value;
    deleting.value = true;
    errorMessage.value = '';
    try {
        await deleteMission(deleted);
    } catch (error: unknown) {
        // the server says why, e.g. that the mission still has files
        // or running actions
        errorMessage.value = getErrorMessage(error);
        return;
    } finally {
        deleting.value = false;
    }

    Notify.create({
        message: 'Mission deleted',
        color: 'positive',
        timeout: 2000,
        position: 'bottom',
    });
    onDialogOK();

    if (route.name === ROUTES.FILES.routeName) {
        await router.push({
            name: ROUTES.MISSIONS.routeName,
            params: { projectUuid: route.params.projectUuid },
        });
    }

    await client.invalidateQueries({
        predicate: (query) =>
            query.queryKey[0] === 'missions' ||
            (query.queryKey[0] === 'mission' &&
                query.queryKey[1] === deleted.uuid),
    });
    await client.invalidateQueries({
        predicate: (query) =>
            query.queryKey[0] === 'projects' ||
            (query.queryKey[0] === 'project' &&
                query.queryKey[1] === deleted.project.uuid),
    });
}
</script>

<style scoped>
.confirm-label {
    display: block;
    margin-bottom: 4px;
    overflow-wrap: anywhere;
}
</style>
