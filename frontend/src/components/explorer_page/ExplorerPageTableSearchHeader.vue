<template>
    <div>
      <q-input
        v-model="search"
        debounce="300"
        outlined
        :label="type + ' Name'"
        :placeholder="`Search for ${type}...`"
      >
        <template #append>
          <q-icon
            name="sym_o_close"
            class="cursor-pointer"
            @click="search = ''"
          />
        </template>
      </q-input>
      <br v-if="url_handler.isListingFiles">

      <q-select
        v-if="url_handler.isListingFiles"
        v-model="_filetype"
        :options="[FileType.BAG, FileType.MCAP]"
        label="File Type"
        outlined
        dense
      />
    </div>
</template>

<script setup lang="ts">



import {QueryHandler} from "src/services/URLHandler";
import {FileType} from "src/enums/FILE_ENUM";
import {computed} from "vue";


const props = defineProps({
  url_handler: {
    type: QueryHandler,
    required: true
  }
})

const search = computed({
  get: () => props.url_handler.search_params.name,
  set: (value: string) => {
    props.url_handler?.setSearch({name: value})
  }
})

const _filetype = computed({
  get: (): FileType => props.url_handler.file_type || FileType.BAG,
  set: (value: FileType) => {
    props.url_handler?.setFileType(value)
  }
})

const type = computed(()=>
{
  if(props.url_handler.isListingProjects)
  {
    return "Project"
  }
  else if(props.url_handler.isListingMissions)
  {
    return "Mission"
  }
  else if(props.url_handler.isListingFiles)
  {
    return "File"
  }
})


</script>