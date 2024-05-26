<template>
  <q-page class="flex">
    <div class="q-pa-md">
      <div class="text-h4">Run Details Page</div>
      <vue-json-pretty :data="data" />
    </div>
  </q-page>
</template>

<script setup lang="ts">

import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';


// print the id of the analysis run (extracted from the route)
import {useRoute} from 'vue-router'
import {useQuery} from '@tanstack/vue-query';
import {analysisDetails} from 'src/services/queries';

const $route = useRoute()

const {data} = useQuery(
  {
    queryKey: ['runs_analysis', $route.params.id],
    queryFn: () => analysisDetails($route.params.id as string)
  }
);

</script>

