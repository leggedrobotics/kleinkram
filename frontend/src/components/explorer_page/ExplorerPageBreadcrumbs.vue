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
      </q-breadcrumbs>
    </div>
  </div>
</template>

<script setup lang="ts">

import {useRoute} from "vue-router";
import {inject, ref, watch} from "vue";
import ROUTES from "src/router/routes";
import RouterService from "src/services/routerService";
import {getProject} from "src/services/queries/project";
import {getMission} from "src/services/queries/mission";

const route = useRoute()
const $routerService: RouterService | undefined = inject('$routerService');

const crumbs = ref<any>([])

watch(() => route.query, async () => {
  await updateCrumbs()
})

const updateCrumbs = async () => {
  const project_uuid = route.query.project_uuid as string | undefined
  const mission_uuid = route.query.mission_uuid as string | undefined


  crumbs.value = [
    {
      name: 'All Projects',
      uuid: 'projects',
      click: () => $routerService?.routeTo(ROUTES.EXPLORER, {})
    },
    project_uuid ? {
      name: await getProject(project_uuid).then((project) => project.name),
      uuid: 'missions',
      click: () => $routerService?.routeTo(ROUTES.EXPLORER, {project_uuid})
    } : {},
    mission_uuid ? {
      name: await getMission(mission_uuid).then((mission) => mission.name),
      uuid: 'files',
      click: () => $routerService?.routeTo(ROUTES.EXPLORER, {mission_uuid})
    } : {}
  ].filter((crumb: any) => !!crumb.uuid)
}

// initial load
updateCrumbs()

</script>