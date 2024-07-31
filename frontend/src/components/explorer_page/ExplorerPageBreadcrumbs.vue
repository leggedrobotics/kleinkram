<template>
  <div class="row q-mb-md">
    <div>
      <q-breadcrumbs>
        <q-breadcrumbs-el
            v-for="crumb in crumbs"
            :key="crumb.uuid"
            :label="crumb.name"
            clickable
            @click="crumb.click"
        >
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
import {useProjectQuery} from "src/queries/projectQuery";
import {useMissionQuery} from "src/queries/missionQuery";

const project_uuid = defineModel<string | undefined>('project_uuid')
const mission_uuid = defineModel<string | undefined>('mission_uuid')

const {data: project, refetch: refetchProject} = useProjectQuery(project_uuid);
const {data: mission, refetch: refetchMission} = useMissionQuery(mission_uuid);

watch(project_uuid, () => refetchProject())
watch(mission_uuid, () => refetchMission())

const isLoading = ref(false)
watch([project_uuid, mission_uuid], () => {
  isLoading.value = true
})
watch([project, mission], () => {
  isLoading.value = false
})

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


</script>