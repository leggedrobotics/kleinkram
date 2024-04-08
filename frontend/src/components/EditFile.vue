<template>
  <q-dialog ref="dialogRef" persistent style="max-width: 1000px">
    <q-card class="q-pa-sm text-center" style="width: 80%; min-height: 300px; max-width: 1000px">
      <q-card-section>
        <h4>
          Edit run {{isLoading ? '...' : data?.name}}
        </h4>
        <q-form v-if="editableFile">
          <div class="row items-center justify-between q-gutter-md">
            <div class="col-5">
              <q-input
                v-model="editableFile.name"
                label="Name"
                outlined
                dense
                clearable
                required
              />
            </div>
            <div class="col-1">
              <q-btn-dropdown
                v-model="dd_open"
                :label="editableFile.project?.name || 'Project'"
                outlined
                dense
                clearable
                required
              >
                <q-list>
                  <q-item
                    v-for="project in projects"
                    :key="project.uuid"
                    clickable
                    @click="editableFile.project = project; dd_open=false"
                  >
                    <q-item-section>
                      <q-item-label>
                        {{ project.name }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-btn-dropdown>
            </div>
            <div class="col-3">
              <div class="q-pa-md" style="max-width: 300px">
                <q-input filled v-model="dateTime">
                  <template v-slot:prepend>
                    <q-icon name="event" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                        <q-date v-model="dateTime" mask="YYYY-MM-DD HH:mm">
                          <div class="row items-center justify-end">
                            <q-btn v-close-popup label="Close" color="primary" flat />
                          </div>
                        </q-date>
                      </q-popup-proxy>
                    </q-icon>
                  </template>

                  <template v-slot:append>
                    <q-icon name="access_time" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                        <q-time v-model="dateTime" mask="YYYY-MM-DD HH:mm" format24h>
                          <div class="row items-center justify-end">
                            <q-btn v-close-popup label="Close" color="primary" flat />
                          </div>
                        </q-time>
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
              </div>
            </div>
          </div>
          <div style="float: right">
            <q-btn
              label="Cancel"
              color="red"
              @click="onDialogCancel"
              class="q-mr-sm"
            />
            <q-btn
              label="Save"
              color="primary"
              @click="_updateRun"/>

          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script setup lang="ts">
import { useMutation, useQuery,useQueryClient } from '@tanstack/vue-query';
import { allProjects, fetchFile } from 'src/services/queries';
import { Ref, ref, watch } from 'vue';
import { FileEntity, Project, Run } from 'src/types/types';
import { updateFile } from 'src/services/mutations';
import { useDialogPluginComponent } from 'quasar'
import { formatDate, parseDate } from 'src/services/dateFormating';

const props = defineProps<{
  file_uuid: string;
}>();

defineEmits([
  ...useDialogPluginComponent.emits
])
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const queryClient = useQueryClient();

const dd_open = ref(false);
const { isLoading, isError, data, error } = useQuery({
  queryKey: ['file', props.file_uuid],
  queryFn: ()=>fetchFile(props.file_uuid) });

const dateTime = ref('');
const editableFile: Ref<FileEntity | null> = ref(null);
// Watch for changes in data.value and update dateTime accordingly
watch(() => data.value, (newValue) => {
  if (newValue?.date) {
    editableFile.value = new FileEntity(newValue.uuid,
      newValue.name,
      newValue.run,
      newValue.date,
      [],
      newValue.size,
      newValue.createdAt,
      newValue.updatedAt,
      newValue.deletedAt);
    dateTime.value = formatDate(new Date(newValue.date));
  }
}, {
  immediate: true, // Run the watcher immediately on component mount
});
const projectsReturn = useQuery<Project[]>({ queryKey: ['projects'], queryFn: allProjects });
const projects = projectsReturn.data

const { mutate: updateFileMutation } = useMutation({
  mutationFn: (fileData: FileEntity) => updateFile(fileData),
  onSuccess(data, variables, context) {
    // queryClient.invalidateQueries([])
  },
});

function _updateRun() {
  const convertedDate = parseDate(dateTime.value);
  if (editableFile.value && convertedDate && !isNaN(convertedDate.getTime())) {
    editableFile.value.date = convertedDate
    updateFileMutation(editableFile.value);
    onDialogOK();
  }
}

</script>

<style scoped>

</style>
