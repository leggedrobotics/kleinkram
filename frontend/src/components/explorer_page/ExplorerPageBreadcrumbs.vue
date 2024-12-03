<template>
    <div class="row">
        <div>
            <q-breadcrumbs>
                <q-breadcrumbs-el
                    v-for="crumb in crumbs"
                    :key="crumb.uuid"
                    @click="crumb.click"
                >
                    <q-btn
                        v-if="!isLastCrumb(crumb)"
                        flat
                        style="padding: 4px 8px"
                    >
                        {{ crumb.name }}
                    </q-btn>

                    <template v-else>
                        <span style="padding: 8px; cursor: default">
                            {{ crumb.name }}
                        </span>
                    </template>
                </q-breadcrumbs-el>

                <template v-if="projectLoading || missionLoading">
                    <q-breadcrumbs-el>
                        <q-skeleton
                            class="q-mr-md q-mb-sm"
                            style="width: 200px; height: 18px; margin-top: 5px"
                        />
                    </q-breadcrumbs-el>
                </template>
            </q-breadcrumbs>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { useMission, useProjectQuery } from 'src/hooks/customQueryHooks';
import { QueryHandler } from 'src/services/QueryHandler';

const properties = defineProps({
    url_handler: {
        type: QueryHandler,
        required: true,
    },
});

const project_uuid = computed(() => properties.url_handler.projectUuid);
const mission_uuid = computed(() => properties.url_handler.missionUuid);

const { data: project, isLoading: projectLoading } =
    useProjectQuery(project_uuid);
const { data: mission, isLoading: missionLoading } = useMission(mission_uuid);

const crumbs = ref<any>([]);

watchEffect(() => {
    crumbs.value = [
        {
            name: 'All Projects',
            uuid: 'projects',
            click: () => {
                properties.url_handler.setProjectUUID(undefined);
                properties.url_handler.setMissionUUID(undefined);
            },
        },
        ...(project.value && !!project_uuid.value
            ? [
                  {
                      name: project.value.name,
                      uuid: project.value.uuid,
                      click: () => {
                          properties.url_handler.setProjectUUID(
                              project.value.uuid,
                          );
                          properties.url_handler.setMissionUUID(undefined);
                      },
                  },
              ]
            : []),
        ...(mission.value && !!mission_uuid.value
            ? [
                  {
                      name: mission.value.name,
                      uuid: mission.value.uuid,
                  },
              ]
            : []),
    ];
});

const isLastCrumb = (crumb: any) => {
    const index = crumbs.value.findIndex((c: any) => c.uuid === crumb.uuid);
    return index === crumbs.value.length - 1;
};
</script>
