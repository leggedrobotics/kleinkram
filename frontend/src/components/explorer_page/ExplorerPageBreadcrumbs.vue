<template>
  <div class="row">
    <div>
      <q-breadcrumbs>
        <q-breadcrumbs-el
            v-for="crumb in crumbs"
            :key="crumb.uuid"
            @click="crumb.click"
        >
          <q-btn flat v-if="!isLastCrumb(crumb)" style="padding: 4px 8px" no-caps>
            {{ crumb.name }}
          </q-btn>

          <template v-else>
            <span style="padding: 8px; cursor: default">
              {{ crumb.name }}
            </span>
          </template>

        </q-breadcrumbs-el>

        <template v-if="isLoading">
          <q-breadcrumbs-el>
            <q-skeleton class="q-mr-md q-mb-sm" style="width: 200px; height: 18px; margin-top: 5px"/>
          </q-breadcrumbs-el>
        </template>

      </q-breadcrumbs>
    </div>
  </div>

</template>

<script setup lang="ts">

import {ref, watch, watchEffect} from "vue";

import {useToggle} from "src/hooks/utils";
import {useMissionQuery, useProjectQuery} from "src/hooks/customQueryHooks";

const project_uuid = defineModel<string | undefined>('project_uuid')
const mission_uuid = defineModel<string | undefined>('mission_uuid')

const {data: project, refetch: refetchProject} = useProjectQuery(project_uuid);
const {data: mission, refetch: refetchMission} = useMissionQuery(mission_uuid);

const isLoading = useToggle([project_uuid, mission_uuid], [project, mission], false)

watch(project_uuid, () => refetchProject())
watch(mission_uuid, () => refetchMission())

const crumbs = ref<any>([])

watchEffect(() => {
  crumbs.value = [
    {
      name: 'All Projects',
      uuid: 'projects',
      click: () => {
        project_uuid.value = undefined
        mission_uuid.value = undefined
      }
    },
    ...(project.value ? [{
      name: project.value.name,
      uuid: project.value.uuid,
      click: () => {
        mission_uuid.value = undefined
      }
    }] : []),
    ...(mission.value ? [{
      name: mission.value.name,
      uuid: mission.value.uuid,
    }] : [])
  ]
});

const isLastCrumb = (crumb: any) => {
  const idx = crumbs.value.findIndex((c: any) => c.uuid === crumb.uuid)
  return idx === crumbs.value.length - 1;
}

</script>