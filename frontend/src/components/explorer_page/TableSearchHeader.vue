<template>
  <template v-if="isListingProjects">
    <div>
      <q-input debounce="300" outlined v-model="search" label="Project Name" placeholder="Search for projects...">
        <template v-slot:append>
          <q-icon name="close" @click="search = ''" class="cursor-pointer"/>
        </template>
      </q-input>
    </div>
  </template>

  <template v-if="isListingMissions">
    <div>
      <q-input debounce="300" outlined v-model="search" label="Mission Name" placeholder="Search for missions...">
        <template v-slot:append>
          <q-icon name="close" @click="search = ''" class="cursor-pointer"/>
        </template>
      </q-input>
    </div>
  </template>

  <template v-if="isListingFiles">
    <div>
      <q-input debounce="300" outlined v-model="search" label="File Name" placeholder="Search for files...">
        <template v-slot:append>
          <q-icon name="close" @click="search = ''" class="cursor-pointer"/>
        </template>
      </q-input>

      <br/>

      <q-select
          v-model="file_type_filter"
          :options="['All', 'MCAP', 'BAG']"
          label="File Type"
          outlined
          dense
      />

    </div>
  </template>
</template>

<script setup lang="ts">

import {ref, watch} from "vue";

const search = defineModel<string>('search')
const file_type_filter = defineModel<string>('file_type_filter')

const project_uuid = defineModel<string | undefined>('project_uuid')
const mission_uuid = defineModel<string | undefined>('mission_uuid')

const isListingProjects = ref(project_uuid.value === undefined && mission_uuid.value === undefined)
const isListingMissions = ref(project_uuid.value && mission_uuid.value === undefined)
const isListingFiles = ref(!!mission_uuid.value)

watch([mission_uuid, project_uuid], () => {

  if (project_uuid.value && !mission_uuid.value) {
    isListingProjects.value = false;
    isListingMissions.value = true;
    isListingFiles.value = false;
  } else if (mission_uuid.value) {
    isListingProjects.value = false;
    isListingMissions.value = false;
    isListingFiles.value = true;
  } else {
    isListingProjects.value = true;
    isListingMissions.value = false;
    isListingFiles.value = false;
  }

})

</script>