<template>
  <q-card class="q-pa-md q-mt-xl q-mb-md" flat bordered>
    <q-card-section>
      <div class="text-h4 q-mb-md">File: {{ data?.filename }}</div>
      <q-separator class="q-mt-md" />
      <div class="q-gutter-md q-mt-xs">
        <div class="row items-start">
          <div class="col-2">
            <div class="text-subtitle3">Project</div>
            <div
                class="text-caption text-primary"
                style="font-size: 16px"
            >
              {{ data?.mission.project.name }}
            </div>
          </div>
          <div class="col-2">
            <div class="text-subtitle3">Mission</div>
            <div
                class="text-caption text-primary"
                style="font-size: 16px"
            >
              {{ data?.mission.name }}
            </div>
          </div>
          <div class="col-3">
            <div v-if="data?.date">
              <div class="text-subtitle3">Start Date</div>
              <div
                  class="text-caption text-primary"
                  style="font-size: 16px"
              >
                {{ formatDate(data.date, true) }}
              </div>
            </div>
          </div>
          <div class="col-2">
            <div v-if="data?.creator">
              <div class="text-subtitle3">Creator</div>
              <div
                  class="text-caption text-primary"
                  style="font-size: 16px"
              >
                {{ data.creator.name }}
              </div>
            </div>
          </div>
          <div class="col-1">
            <q-btn
                flat
                label="Download"
                icon="cloud_download"
                @click="_downloadFile"
                class="full-width"
            ></q-btn>
          </div>
          <div class="col-2">
            <q-btn
                flat
                label="Copy public link"
                icon="content_copy"
                @click="_copyLink"
                class="full-width"
            ></q-btn>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>

  <q-card class="q-pa-md q-mb-xl" flat bordered>
    <q-card-section>
      <q-input
          v-model="filterKey"
          filled
          placeholder="Search"
          class="q-mb-md"
      />
      <q-table
          flat bordered
          separator="none"
          v-if="data?.type === FileType.MCAP"
          ref="tableoniRef"
          v-model:pagination="pagination"
          :rows="data?.topics"
          :columns="columns"
          row-key="uuid"
          selection="multiple"
          :loading="isLoading"
          :filter="filterKey"
      >
      </q-table>
      <q-btn
          v-else
          label="Got to Mcap"
          icon="turn_slight_right"
          @click="redirectToMcap"
      >
      </q-btn>
    </q-card-section>
  </q-card>
</template>
<script setup lang="ts">
import {useQuery} from '@tanstack/vue-query';
import {formatDate} from 'src/services/dateFormating';
import {computed, inject, Ref, ref} from 'vue';
import {copyToClipboard, Notify, QTable} from 'quasar';
import {FileType} from 'src/enums/FILE_ENUM';
import RouterService from 'src/services/routerService';
import ROUTES from 'src/router/routes';
import {FileEntity} from 'src/types/FileEntity';
import {downloadFile, fetchFile, filesOfMission,} from 'src/services/queries/file';

const $routerService: RouterService | undefined = inject('$routerService');

const props = defineProps<{
  uuid: string;
}>();

const file_uuid = computed(() => props.uuid);
const filterKey = ref<string>('');
const tableoniRef: Ref<QTable | null> = ref(null);

const {isLoading, isError, data, error} = useQuery<FileEntity>({
  queryKey: ['file', file_uuid],
  queryFn: () => fetchFile(file_uuid.value),
});

const missionUUID = computed(() => data.value?.mission?.uuid);

const {data: filesReturn, refetch} = useQuery({
  queryKey: ['files', missionUUID.value],
  queryFn: () => filesOfMission(missionUUID.value || ''),
  enabled() {
    return !!missionUUID.value;
  },
});

const columns = [
  {
    name: 'Topic',
    label: 'Topic',
    field: 'name',
    sortable: true,
    align: 'left',
  },
  {name: 'Datatype', label: 'Datatype', field: 'type', sortable: true},
  {
    name: 'NrMessages',
    label: 'NrMessages',
    field: 'nrMessages',
    sortable: true,
  },
  {
    name: 'Frequency',
    label: 'Frequency',
    field: 'frequency',
    sortable: true,
  },
];

const downloadURL = ref<string>('');

async function _downloadFile() {
  const res = await downloadFile(props.uuid, true);
  const a = document.createElement('a');
  a.href = res;
  a.download = data.value?.filename || 'file.mcap'; // Optionally set the file name for the download
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function redirectToMcap() {
  const mcap = filesReturn.value?.find((file: FileEntity) => {
    return file.filename === data.value?.filename.replace('.bag', '.mcap');
  });
  if (mcap && $routerService) {
    await $routerService.routeTo(ROUTES.FILE, {uuid: mcap.uuid});
  }
}

async function _copyLink() {
  const res = await downloadFile(props.uuid, false);
  await copyToClipboard(res);
  Notify.create({
    group: false,
    message: 'Copied: Link valid for 7 days',
    color: 'positive',
    position: 'top-right',
    timeout: 2000,
  });
}

const pagination = ref({
  sortBy: 'name',
  descending: false,
  page: 1,
  rowsPerPage: 20,
});
</script>
<style scoped></style>
