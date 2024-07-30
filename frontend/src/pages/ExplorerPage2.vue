<template>

  <h1 class="text-h4 q-mt-xl" style="font-weight: 500">Project Explorer</h1>

  <!-- Action Bar and Breadcrumbs -->
  <div>
    <ExplorerPageBreadcrumbs/>
  </div>

  <q-card class="q-pa-md q-mb-xl" flat bordered>

    <q-card-actions class="flex justify-between items-center q-ml-md">
      <div>
        <h2 class="text-h5 q-mb-xs">Explore all Projects</h2>
        <HelpMessage/>
      </div>
      <q-btn outline @click="() => refresh++" color="grey-8" icon="refresh"/>
    </q-card-actions>

    <q-card-section style="padding-top: 10px">
      <q-input debounce="300" outlined v-model="search" label="Project Name" placeholder="Search for projects...">
        <template v-slot:append>
          <q-icon name="close" @click="search = ''" class="cursor-pointer"/>
        </template>
      </q-input>
    </q-card-section>

    <q-card-section>
      <ExplorerPageTable :refresh="refresh"/>
    </q-card-section>

  </q-card>

</template>

<script setup lang="ts">

import {inject, ref, watch} from "vue";
import ExplorerPageTable from "components/explorer_page/ExplorerPageTable.vue";
import ExplorerPageBreadcrumbs from "components/explorer_page/ExplorerPageBreadcrumbs.vue";
import RouterService from "src/services/routerService";
import HelpMessage from "components/HelpMessage.vue";

const $routerService: RouterService | undefined = inject('$routerService');

const search = ref('')
const refresh = ref(0);

watch(search, () => {
  $routerService?.pushToQuery({search: search.value})
  refresh.value++;
})

</script>
