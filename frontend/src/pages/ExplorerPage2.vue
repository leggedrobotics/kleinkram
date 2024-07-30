<template>

  <h1 class="text-h4 q-mt-xl" style="font-weight: 500">Project Explorer</h1>

  <div class="q-mb-md">
    <ExplorerPageBreadcrumbs/>

    <div class="flex justify-between items-center q-mt-md">
      <div></div>
      <q-btn
          color="primary"
          label="Create Project"
          @click="createNewProject"
      />
    </div>

  </div>

  <q-card class="q-pa-md q-mb-xl" flat bordered>

    <q-card-section class="flex justify-between items-center">

      <Suspense>
        <TableHeader/>

        <template #fallback>
          <div style="width: 550px; height: 67px;">
            <q-skeleton class="q-mr-md q-mb-sm q-mt-sm" style="width: 300px; height: 20px"/>
            <q-skeleton class="q-mr-md" style="width: 200px; height: 18px"/>
          </div>
        </template>

      </Suspense>

      <q-btn outline @click="() => refresh++" color="grey-8" icon="refresh"/>
    </q-card-section>

    <q-card-section style="padding-top: 10px">
      <q-input debounce="300" outlined v-model="search" label="Project Name" placeholder="Search for projects...">
        <template v-slot:append>
          <q-icon name="close" @click="search = ''" class="cursor-pointer"/>
        </template>
      </q-input>
    </q-card-section>

    <q-card-section>
      <Suspense>
        <ExplorerPageTable :refresh="refresh"/>

        <template #fallback>
          <div style="width: 100%; height: 645px;">
            <q-skeleton class="q-mr-md q-mb-sm q-mt-sm" style="width: 100%; height: 40px"/>

            <div v-for="i in 20" :key="i" class="q-mt-sm">
              <q-skeleton class="q-mr-md q-mb-sm" style="width: 100%; height: 20px; opacity: 0.5"/>
            </div>

          </div>
        </template>

      </Suspense>
    </q-card-section>

  </q-card>

</template>

<script setup lang="ts">

import {inject, ref, watch} from "vue";
import ExplorerPageTable from "components/explorer_page/ExplorerPageTable.vue";
import ExplorerPageBreadcrumbs from "components/explorer_page/ExplorerPageBreadcrumbs.vue";
import RouterService from "src/services/routerService";
import TableHeader from "components/explorer_page/TableHeader.vue";
import CreateProjectDialog from "components/CreateProjectDialog.vue";
import {useQuasar} from "quasar";

const $routerService: RouterService | undefined = inject('$routerService');

const search = ref('')
const refresh = ref(0);

watch(search, () => {
  $routerService?.pushToQuery({search: search.value})
  refresh.value++;
})

const $q = useQuasar();

const createNewProject = () => $q.dialog({
  title: 'Create new project',
  component: CreateProjectDialog,
}).onOk(() => {

  // TODO: set search to new project name....
  // search.value = 'new project name'

})


</script>
