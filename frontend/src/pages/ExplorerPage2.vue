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
      <q-input outlined v-model="search" label="Project Name" placeholder="Search for projects..."/>
    </q-card-section>

    <q-card-section>

      <Suspense>
        <ExplorerPageTable :refresh="refresh"/>

        <template #fallback>
          <ExplorerPageLoadingPreview/>
        </template>

      </Suspense>

    </q-card-section>

  </q-card>

</template>

<script setup lang="ts">

import {ref} from "vue";
import ExplorerPageTable from "components/explorer_page/ExplorerPageTable.vue";
import ExplorerPageBreadcrumbs from "components/explorer_page/ExplorerPageBreadcrumbs.vue";
import ExplorerPageLoadingPreview from "components/explorer_page/ExplorerPageLoadingPrview.vue";

const search = ref('')
const refresh = ref(0);


</script>