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


import {useDisplayType} from "src/hooks/utils";

const search = defineModel<string>('search')
const file_type_filter = defineModel<string>('file_type_filter')

const project_uuid = defineModel<string | undefined>('project_uuid')
const mission_uuid = defineModel<string | undefined>('mission_uuid')

const {isListingProjects, isListingMissions, isListingFiles} = useDisplayType(project_uuid, mission_uuid)

</script>