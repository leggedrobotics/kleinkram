<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 100px; max-width: 500px"
        >
            <h5>Move mission {{ mission?.name }} to another project</h5>
            <div class="row q-gutter-sm q-ma-md">
                <div class="col-7 col-md-7">
                    <q-btn-dropdown
                        v-model="dd_open"
                        dense
                        flat
                        class="full-width button-border"
                        :label="selectedProject?.name || 'Project'"
                    >
                        <q-list>
                            <q-item
                                v-for="project in projects"
                                :key="project.uuid"
                                clickable
                                @click="
                                    () => {
                                        selectedProject = project;
                                        dd_open = false;
                                    }
                                "
                            >
                                <q-item-section>
                                    <q-item-label>
                                        {{ project.name }}
                                    </q-item-label>
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-btn-dropdown>
                </div>
                <div class="col-2">
                    <q-btn
                        label="OK"
                        color="primary"
                        unelevated
                        style="margin-right: 5px"
                        @click="onOk"
                    />
                </div>
                <div class="col-1">
                    <q-btn
                        label="Cancel"
                        flat
                        class="q-mr-sm button-border"
                        @click="onDialogOK"
                    />
                </div>
            </div>
        </q-card>
    </q-dialog>
</template>
<script setup lang="ts">
import { MissionWithFilesDto } from '@api/types/mission/mission.dto';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify, useDialogPluginComponent } from 'quasar';
import { useFilteredProjects } from 'src/hooks/query-hooks';
import { moveMission } from 'src/services/mutations/mission';
import { computed, ref } from 'vue';

import { ProjectDto } from '@api/types/project/base-project.dto';

const { dialogRef, onDialogOK, onDialogHide } = useDialogPluginComponent();

const properties = defineProps<{
    mission?: MissionWithFilesDto;
}>();

const queryClient = useQueryClient();

const { data } = useFilteredProjects(500, 0, 'name', true, {});

const projects = computed(() => (data.value ? data.value.data : []));

const selectedProject = ref<ProjectDto | undefined>(
    properties.mission?.project ?? undefined,
);

const dd_open = ref(false);

async function onOk() {
    if (!properties.mission || !selectedProject.value) {
        return;
    }
    const creating = Notify.create({
        group: false,
        message: `Moving mission ${properties.mission.name} to project ${selectedProject.value.name}`,
        color: 'grey',
        spinner: true,
        timeout: 4000,
        position: 'bottom',
    });

    try {
        await moveMission(properties.mission.uuid, selectedProject.value.uuid);
        creating({
            message: `Mission ${properties.mission.name} moved to project ${selectedProject.value.name}`,
            color: 'positive',
            spinner: false,
            timeout: 4000,
        });
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
        onDialogOK(selectedProject.value.uuid);
    } catch (error: any) {
        creating({
            message: `Error moving mission ${properties.mission.name} to project ${selectedProject.value.name}`,
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
