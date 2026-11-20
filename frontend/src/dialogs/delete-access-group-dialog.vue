<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="isPending"
        size="sm"
        :submit-disabled="!confirmed || isPending"
        @submit="confirm"
    >
        <template #title>Delete Access Group</template>
        <template #subtitle>{{ accessGroup.name }}</template>

        <template #content>
            <template v-if="projectNames.length > 0 || memberCount > 0">
                <p>The group's access is removed with it:</p>
                <ul class="q-mt-none">
                    <li v-if="projectNames.length > 0">
                        <b>{{ projectNames.length }}</b>
                        {{
                            projectNames.length === 1 ? 'project' : 'projects'
                        }}:
                        <q-chip
                            v-for="projectName in projectNames"
                            :key="projectName"
                            dense
                            square
                        >
                            {{ projectName }}
                        </q-chip>
                    </li>
                    <li v-if="memberCount > 0">
                        <b>{{ memberCount }}</b>
                        {{
                            memberCount === 1 ? 'member loses' : 'members lose'
                        }}
                        access granted through this group
                    </li>
                </ul>
            </template>
            <label :for="inputId" class="confirm-label">
                Type <b>{{ accessGroup.name }}</b> to confirm. This can't be
                undone.
            </label>
            <q-input
                v-model="nameCheck"
                no-error-icon
                :for="inputId"
                outlined
                dense
                autofocus
                autocomplete="off"
            />
        </template>

        <template #actions>
            <span class="disabled-reason">
                <q-btn
                    flat
                    no-caps
                    label="Delete Group"
                    class="bg-button-danger"
                    :disable="!confirmed"
                    :loading="isPending"
                    @click="confirm"
                />
                <q-tooltip v-if="!confirmed"
                    >Type the name to confirm</q-tooltip
                >
            </span>
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { AccessGroupDto } from '@kleinkram/api-dto/types/access-control/access-group.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { getDialogErrorMessage } from 'src/services/error-handling';
import { deleteAccessGroup } from 'src/services/mutations/access';
import { computed, ref, useId } from 'vue';

const { accessGroup } = defineProps<{ accessGroup: AccessGroupDto }>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const queryClient = useQueryClient();

const inputId = `delete-access-group-${useId()}`;
const nameCheck = ref('');
const errorMessage = ref('');
const confirmed = computed(() => nameCheck.value === accessGroup.name);

const projectNames = computed(() =>
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (accessGroup.projectAccesses ?? []).map((access) => access.name),
);
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const memberCount = computed(() => accessGroup.memberships?.length ?? 0);

const { mutate, isPending } = useMutation({
    mutationFn: () => deleteAccessGroup(accessGroup.uuid),
    onSuccess: async () => {
        await queryClient.invalidateQueries({
            predicate: (query) =>
                ['accessGroups', 'projects', 'project'].includes(
                    query.queryKey[0] as string,
                ),
        });
        Notify.create({
            message: 'Access Group Deleted',
            color: 'positive',
            position: 'bottom',
            timeout: 2000,
        });
        onDialogOK();
    },
    onError: (error: Error) => {
        errorMessage.value = getDialogErrorMessage(error);
    },
});

const confirm = (): void => {
    if (isPending.value || !confirmed.value) return;
    errorMessage.value = '';
    mutate();
};
</script>

<style scoped>
.confirm-label {
    display: block;
    margin-bottom: 4px;
    overflow-wrap: anywhere;
}
</style>
