<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 100px; max-width: 500px"
        >
            <h5>Move mission {{ mission?.name }} to another project</h5>

            <div class="column q-gutter-y-md q-ma-md">
                <ScopeSelector
                    v-model:project-uuid="selectedProjectUuid"
                    :show-mission="false"
                    :required="true"
                />

                <div class="row justify-end q-gutter-x-sm">
                    <q-btn
                        label="Cancel"
                        flat
                        class="button-border"
                        @click="onDialogOK"
                    />
                    <q-btn
                        label="OK"
                        color="primary"
                        unelevated
                        :disable="
                            !selectedProjectUuid ||
                            selectedProjectUuid === mission?.project?.uuid
                        "
                        @click="onOk"
                    />
                </div>
            </div>
        </q-card>
    </q-dialog>
</template>

<script setup lang="ts">
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import { useQueryClient } from '@tanstack/vue-query';
import ScopeSelector from 'components/common/scope-selector.vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { useScopeSelection } from 'src/composables/use-scope-selection';
import { moveMission } from 'src/services/mutations/mission';
import { ref } from 'vue';

const { dialogRef, onDialogOK, onDialogHide } = useDialogPluginComponent();

const properties = defineProps<{
    mission?: MissionWithFilesDto;
}>();

const queryClient = useQueryClient();

const selectedProjectUuid = ref<string | undefined>(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    properties.mission?.project?.uuid,
);

const { selectedProject } = useScopeSelection(selectedProjectUuid);

async function onOk(): Promise<void> {
    if (
        !properties.mission ||
        !selectedProjectUuid.value ||
        !selectedProject.value
    ) {
        return;
    }

    const targetProjectName = selectedProject.value.name;

    const creating = Notify.create({
        group: false,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions
        message: `Moving mission ${properties.mission.name} to project ${targetProjectName}`,
        color: 'grey',
        spinner: true,
        timeout: 4000,
        position: 'bottom',
    });

    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        await moveMission(properties.mission.uuid, selectedProjectUuid.value);

        creating({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions
            message: `Mission ${properties.mission.name} moved to project ${targetProjectName}`,
            color: 'positive',
            spinner: false,
            timeout: 4000,
        });

        // Invalidate queries to refresh lists
        const cache = queryClient.getQueryCache();
        const filtered = cache
            .getAll()
            .filter(
                (query) =>
                    query.queryKey[0] === 'missions' ||
                    query.queryKey[0] === 'projects',
            );
        await Promise.all(
            filtered.map((query) =>
                queryClient.invalidateQueries({
                    queryKey: query.queryKey,
                }),
            ),
        );

        onDialogOK(selectedProjectUuid.value);
    } catch (error: unknown) {
        creating({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions
            message: `Error moving mission ${properties.mission.name} to project ${targetProjectName}`,
            color: 'negative',
            spinner: false,
            timeout: 4000,
        });
        console.error(error);
        onDialogHide();
    }
}
</script>

<style scoped></style>
