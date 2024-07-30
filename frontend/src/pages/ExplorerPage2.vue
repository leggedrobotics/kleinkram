<template>

  <h1 class="text-h5">Project Explorer</h1>

  <!-- Action Bar and Breadcrumbs -->
  <div>
    <ExplorerPageBreadcrumbs/>
  </div>


  <q-card class="q-pa-md" flat bordered>

    <q-card-actions align="right">
      <q-btn outline @click="() => refresh++" color="grey-8" icon="refresh"/>
    </q-card-actions>

    <q-card-section>
      <q-input debounce="300" outlined v-model="search" label="Project Name" placeholder="Search for projects..."/>
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

const $routerService: RouterService | undefined = inject('$routerService');

const search = ref('')
const refresh = ref(0);

watch(search, () => {
  $routerService?.pushToQuery({search: search.value})
  refresh.value++;
})

</script>