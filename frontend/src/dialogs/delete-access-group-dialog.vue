<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete "{{ accessGroup.name }}"? </template>

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
            <p>
                Type <b>{{ accessGroup.name }}</b> to confirm.
            </p>
            <q-input
                v-model="nameCheck"
                outlined
                dense
                autofocus
                placeholder="Group name"
                @keyup.enter="confirm"
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Delete group"
                class="bg-button-danger"
                :disable="nameCheck !== accessGroup.name"
                :loading="isPending"
                @click="confirm"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { AccessGroupDto } from '@kleinkram/api-dto/types/access-control/access-group.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { getErrorMessage } from 'src/services/error-handling';
import { deleteAccessGroup } from 'src/services/mutations/access';
import { computed, ref } from 'vue';

const { accessGroup } = defineProps<{ accessGroup: AccessGroupDto }>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const queryClient = useQueryClient();

const nameCheck = ref('');

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
        Notify.create({
            message: `Failed to delete access group: ${getErrorMessage(error)}`,
            color: 'negative',
            position: 'bottom',
        });
    },
});

const confirm = (): void => {
    if (isPending.value || nameCheck.value !== accessGroup.name) return;
    mutate();
};
</script>
