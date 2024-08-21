<template>
    <base-dialog title="New Mission" ref="dialogRef">
        <template #title> New Mission</template>

        <template #content>
            <create-mission
                :project="project || undefined"
                v-if="isFetched || project_uuid === undefined"
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Create Mission"
                class="bg-button-primary"
                @click="onDialogOK"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import CreateMission from 'components/CreateMission.vue';
import { useProjectQuery } from 'src/hooks/customQueryHooks';
import { ref } from 'vue';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { useDialogPluginComponent } from 'quasar';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { project_uuid } = defineProps<{ project_uuid: string | undefined }>();
const { data: project, isFetched } = useProjectQuery(ref(project_uuid));
</script>
