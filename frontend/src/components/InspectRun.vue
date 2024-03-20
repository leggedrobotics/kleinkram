<template>
  <q-card>
    <q-card-section>
      <h3>{{data?.name}}</h3>
      <div class="row">
        <div class="col-1">
          {{data?.project.name}}
        </div>
        <div class="col-1">
          <p v-if="data?.date">
            {{formatDate(data?.date, true)}}
          </p>
        </div>
        <div class="col-1">
          <q-btn
            label="Download"
            icon="cloud_download"
            @click="_downloadBag"/>
        </div>

      </div>

    </q-card-section>
    <q-card-section>
      <QTable
        ref="tableoniRef"
        v-model:pagination="pagination"
        title="Topics"
        :rows="data?.topics"
        :columns="columns"
        row-key="uuid"
        :loading="isLoading"
      >

      </QTable>
    </q-card-section>
  </q-card>
</template>
<script setup lang="ts">

import { useQuery } from '@tanstack/vue-query';
import { downloadBag, fetchRun } from 'src/services/queries';
import { Run } from 'src/types/types';
import { formatDate } from 'src/services/dateFormating';
import { Ref, ref, watch, watchEffect } from 'vue';
import { QTable } from 'quasar';

const props = defineProps<{
  run_uuid: string;
}>();

const tableoniRef: Ref<QTable | null> = ref(null);


const { isLoading, isError, data, error } = useQuery<Run>({
  queryKey: ['run', props.run_uuid],
  queryFn: ()=>fetchRun(props.run_uuid) });

const columns = [
  { name: 'Topic', label: 'Topic', field: 'name', sortable: true, align: 'left' },
  { name: 'Datatype', label: 'Datatype', field: 'type', sortable: true },
  { name: 'NrMessages', label: 'NrMessages', field: 'nrMessages', sortable: true },
  {name: 'Frequency', label: 'Frequency', field: 'frequency', sortable: true },
]

const downloadURL = ref<string>('');
async function _downloadBag() {
  const res = await downloadBag(props.run_uuid)
  console.log(res)
  const a = document.createElement('a');
  a.href = res;
  a.download = data.value?.name; // Optionally set the file name for the download
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const pagination = ref({ sortBy: 'name', descending: false, page: 1, rowsPerPage: 10 });

</script>
<style scoped>

</style>
