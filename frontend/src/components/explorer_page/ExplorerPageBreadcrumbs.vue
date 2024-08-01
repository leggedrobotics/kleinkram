<template>
  <div class="row q-mt-md">
    <div>
      <q-breadcrumbs>
        <q-breadcrumbs-el
          v-for="crumb in crumbs"
          :key="crumb.uuid"
          :label="crumb.name"
          clickable
          @click="crumb.click"
        />

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

import {computed, ref, watch, watchEffect} from "vue";

import {useToggle} from "src/hooks/utils";
import {useMissionQuery, useProjectQuery} from "src/hooks/customQueryHooks";
import {QueryHandler} from "src/services/URLHandler";

const props = defineProps({
  url_handler: {
    type: QueryHandler,
    required: true
  }
})

const project_uuid = computed(() => props.url_handler.project_uuid)
const mission_uuid = computed(() => props.url_handler.mission_uuid)

const {data: project, isLoading: projectLoading} = useProjectQuery(project_uuid)
const {data: mission, isLoading: missionLoading} = useMissionQuery(mission_uuid)

const crumbs = ref<any>([])

watchEffect(() => {
  crumbs.value = [
    {
      name: 'All Projects',
      uuid: 'projects',
      click: () => {
        props.url_handler?.setProjectUUID(undefined)
        props.url_handler?.setMissionUUID( undefined)
      }
    },
    ...(project.value ? [{
      name: project.value.name,
      uuid: project.value.uuid,
      click: () => {
        props.url_handler.setProjectUUID(project.value?.uuid)
        props.url_handler.setMissionUUID(undefined)
      }
    }] : []),
    ...(mission.value ? [{
      name: mission.value.name,
      uuid: mission.value.uuid,
    }] : [])
  ]
});


</script>