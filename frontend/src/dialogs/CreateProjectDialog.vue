<template>
  <q-dialog ref="dialogRef">
    <q-card style="width: 95%; max-width: 800px">

      <q-card-section>
        <div class="text-h6">Create New Project</div>
      </q-card-section>

      <q-card-section style="max-height: 50vh; height: 420px; margin: 0; padding: 0" class="scroll">

        <q-tabs
            v-model="tab"
            dense
            class="text-grey"
            align="justify"
            active-color="primary"
            narrow-indicator
        >
          <q-tab name="meta_data" label="New Project" style="color: #222"/>
          <q-tab name="tags" label="Configure Tags" style="color: #222"/>
          <q-tab name="manage_access" label="Manage Access" style="color: #222"/>
        </q-tabs>

        <q-separator/>

        <q-tab-panels v-model="tab" class="q-pa-lg">
          <q-tab-panel name="meta_data">

            <p>
              Create a new project by providing a name and description. The project name must be globally unique,
              additionally you must provide a brief description of the project.
            </p>

            <q-input
                ref="projectNameInput"
                v-model="newProjectName"
                outlined
                autofocus
                style="padding-bottom: 30px"
                label="Project Name *"
                :rules="[
              val => !!val || 'A project name cannot be empty!' ,
              val => !invalidProjectNames.includes(val) || 'A project with that name already exists!'
            ]"
                @update:model-value="() => {
              hasValidInput = !!newProjectName && !!newProjectDescription && !invalidProjectNames.includes(newProjectName)
            }"
            />

            <q-input
                v-model="newProjectDescription"
                type="textarea"
                outlined
                style="padding-bottom: 10px"
                label="Project Description *"
                :rules="[val => !!val || 'Project Description is required']"
                @update:model-value="hasValidInput = !!newProjectName && !!newProjectDescription"
            />

          </q-tab-panel>

          <q-tab-panel name="tags">
            <div class="text-h6">Configure Tags</div>
            Tags can be used to enforce the addition of certain metadata to every mission of the project.
            Tags could be for example the name of the robot, the location of the mission, etc.

            <q-skeleton v-if="true" style="height: 200px; margin-top: 20px">
              <div class="q-pa-md">
                Comming soon...
              </div>
            </q-skeleton>

          </q-tab-panel>

          <q-tab-panel name="manage_access">
            <div class="text-h6">Manage Access</div>
            By default all user of the organization can view your project. External users cannot.
            <br/>
            You can add groups or individual users to your project to give them access to it.

            <q-skeleton v-if="true" style="height: 200px; margin-top: 20px">
              <div class="q-pa-md">
                Comming soon...
              </div>
            </q-skeleton>
          </q-tab-panel>

        </q-tab-panels>
      </q-card-section>


      <q-separator/>

      <q-card-actions align="right">
        <q-btn flat label="Close" color="red" v-close-popup/>
        <q-btn label="Create Project" color="primary" @click="submitNewProject"
               :disable="!hasValidInput"/>
      </q-card-actions>

    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import {QInput, useDialogPluginComponent} from 'quasar';
import {ref} from "vue";
import {createProject} from "src/services/mutations/project";
import {AxiosError} from "axios";

const {dialogRef, onDialogOK} = useDialogPluginComponent();

const projectNameInput = ref<QInput>()
const newProjectName = ref('')
const newProjectDescription = ref('')
const invalidProjectNames = ref<string[]>([])

const tab = ref('meta_data')

const hasValidInput = ref(false)
const submitNewProject = async () => {

  await createProject(
      newProjectName.value,
      newProjectDescription.value,
      []
  ).catch((error: AxiosError<{ message: string, statusCode: number }>) => {

    if (
        error.code == "ERR_BAD_REQUEST" &&
        error.response?.data.message.includes("Project with that name already exists")) {
      invalidProjectNames.value.push(newProjectName.value)
      projectNameInput.value?.getNativeElement().focus()

    }

    // abort the close of the dialog
    dialogRef.value?.show()

  });

  onDialogOK()

}

</script>
