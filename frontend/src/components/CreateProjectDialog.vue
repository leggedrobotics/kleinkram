<template>
  <q-dialog ref="dialogRef">
    <q-card style="width: 95%; max-width: 800px">

      <q-card-section>
        <div class="text-h6">Create New Project</div>
      </q-card-section>

      <q-separator/>

      <q-card-section style="max-height: 50vh; margin: 20px 0" class="scroll">

        <p style="padding-bottom: 20px">
          Create a new project by providing a name and description. The project name must be globally unique.
        </p>

        <q-input
            ref="projectNameInput"
            v-model="newProjectName"
            outlined
            autofocus
            style="padding-bottom: 30px"
            label="Project Name"
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
            outlined
            autofocus
            style="padding-bottom: 30px"
            label="Project Description"
            :rules="[val => !!val || 'Project Description is required']"
            @update:model-value="hasValidInput = !!newProjectName && !!newProjectDescription"
        />

      </q-card-section>

      <q-separator/>

      <q-card-actions align="right">
        <q-btn flat label="Close" color="red" v-close-popup/>
        <q-btn label="Create Project" color="primary" v-close-popup @click="submitNewProject"
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

const {dialogRef} = useDialogPluginComponent();

const projectNameInput = ref<QInput>()
const newProjectName = ref('')
const newProjectDescription = ref('')
const invalidProjectNames = ref<string[]>([])

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

}

</script>

<style scoped></style>
