<template>
  <div class="row">
    <div>
      <q-breadcrumbs>
        <q-breadcrumbs-el
            v-for="crumb in crumbs"
            :key="crumb.uuid"
            @click="crumb.click"
        >
          <q-btn flat v-if="!isLastCrumb(crumb)" style="padding: 4px 8px">
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

const isLastCrumb = (crumb: any) => {
  const idx = crumbs.value.findIndex((c: any) => c.uuid === crumb.uuid)
  return idx === crumbs.value.length - 1;
}

</script>