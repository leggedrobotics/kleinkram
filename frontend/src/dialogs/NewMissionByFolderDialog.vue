<template>
    <base-dialog title="New Mission" ref="dialogRef">
        <template #title> Upload Folder</template>

        <template #tabs>
            <q-tabs
                v-model="tab_selection"
                dense
                class="text-grey"
                align="left"
                active-color="primary"
            >
                <q-tab
                    name="meta_data"
                    label="Mission Details*"
                    style="color: #222"
                    :disable="missionCreated"
                />
                <q-tab
                    name="tags"
                    :label="
                        'Tags' +
                        (!!project && project.requiredTags.length >= 1
                            ? '*'
                            : '')
                    "
                    style="color: #222"
                    :disable="missionCreated"
                />
            </q-tabs>
        </template>
        <template #content>
            <q-tab-panels v-model="tab_selection">
                <q-tab-panel name="meta_data" style="min-height: 280px">
                    <p>
                        Project:<b style="margin-left: 10px">{{
                            project?.name
                        }}</b>
                    </p>

                    <label for="missionName">Mission Name *</label>
                    <q-input
                        name="missionName"
                        ref="missionNameInput"
                        v-model="missionName"
                        outlined
                        required
                        clearable
                        autofocus
                        dense
                        placeholder="Name...."
                        style="padding-bottom: 30px"
                        :error="isInErrorState"
                        :error-message="errorMessage"
                        v-on:update:model-value="isInErrorState = false"
                    />
                    <input
                        type="file"
                        webkitdirectory
                        style="display: none"
                        ref="HTMLinput"
                        @change="handle"
                    />
                    <q-file
                        outlined
                        style="min-width: 300px"
                        v-model="files"
                        @click="transferClick"
                    >
                        <template #prepend>
                            <q-icon name="sym_o_attach_file" />
                        </template>

                        <template #append>
                            <q-icon name="sym_o_cancel" @click="files = []" />
                        </template>
                    </q-file>
                </q-tab-panel>
                <q-tab-panel name="tags" style="min-height: 280px">
                    <SelectMissionTags
                        :tag-values="tagValues"
                        :projectUUID="project.uuid"
                        @update:tagValues="(update) => (tagValues = update)"
                    />
                </q-tab-panel>
            </q-tab-panels>
        </template>

        <template #actions>
            <q-btn
                v-if="tab_selection === 'meta_data'"
                flat
                label="Next"
                :disable="missionName.length < 3"
                @click="tab_selection = 'tags'"
                class="bg-button-primary"
            />
            <q-btn
                v-if="tab_selection === 'tags'"
                flat
                label="Create Mission"
                class="bg-button-primary"
                :disable="!allRequiredTagsSet"
                @click="
                    () => {
                        submitNewMission();
                    }
                "
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { computed, ref, Ref, watch } from 'vue';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { Notify, QInput, useDialogPluginComponent } from 'quasar';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Project } from 'src/types/Project';
import { getProject } from 'src/services/queries/project';
import { createMission } from 'src/services/mutations/mission';
import { Mission } from 'src/types/Mission';
import { FileUpload } from 'src/types/FileUpload';
import SelectMissionTags from 'components/SelectMissionTags.vue';
import { usePermissionsQuery } from 'src/hooks/customQueryHooks';
import { createFileAction } from 'src/services/fileService';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const tab_selection = ref('meta_data');

const props = defineProps<{
    project_uuid: string | undefined;
    uploads: Ref<FileUpload[]>;
}>();

const HTMLinput = ref();
const project_uuid = ref(props.project_uuid);
const newMission: Ref<Mission | undefined> = ref(undefined);
const queryClient = useQueryClient();
const files = ref<File[]>([]);

const { data: project, refetch }: { data: Ref<Project>; refetch: Function } =
    useQuery<Project>({
        queryKey: computed(() => ['project', project_uuid]),
        queryFn: () => getProject(project_uuid.value as string),
        enabled: computed(() => !!project_uuid.value),
    });

// we load the new project if the project_uuid changes
watch(project_uuid, () => refetch());

const missionName = ref('');
const isInErrorState = ref(false);
const errorMessage = ref('');
const uploadingFiles = ref<Record<string, Record<string, string>>>([]);

const permissions = usePermissionsQuery();

const tagValues: Ref<Record<string, string>> = ref({});

const allRequiredTagsSet = computed(() => {
    return project?.value?.requiredTags.every(
        (tag) =>
            tagValues.value[tag.uuid] !== undefined &&
            tagValues.value[tag.uuid] !== '',
    );
});

const missionCreated = computed(() => {
    return !!newMission.value;
});

function handle(a) {
    files.value = a.target.files;
    if (files.value.length > 0) {
        missionName.value = files.value[0].webkitRelativePath.split('/')[0];
    }
}

function transferClick(e) {
    e.preventDefault();
    HTMLinput.value.click();
}

const submitNewMission = async () => {
    if (!project.value) {
        return;
    }
    const resp = await createMission(
        missionName.value,
        project.value.uuid,
        tagValues.value,
    ).catch((e) => {
        tab_selection.value = 'meta_data';
        isInErrorState.value = true;
        errorMessage.value = e.response.data.message;
    });

    // exit if the request failed
    if (!resp) return;
    newMission.value = resp;
    newMission.value.project = project.value;
    const cache = queryClient.getQueryCache();
    const filtered = cache
        .getAll()
        .filter(
            (query) =>
                query.queryKey[0] === 'missions' &&
                query.queryKey[1] === project.value?.uuid,
        );
    filtered.forEach((query) => {
        console.log('Invalidating query', query.queryKey);
        queryClient.invalidateQueries(query.queryKey);
    });
    Notify.create({
        message: `Mission ${missionName.value} created`,
        color: 'positive',
        spinner: false,
        timeout: 4000,
        position: 'bottom',
    });
    const created = createFileAction(
        newMission.value,
        newMission.value?.project,
        [...files.value].filter(
            (file: File) =>
                file.name.endsWith('.bag') || file.name.endsWith('.mcap'),
        ),
        queryClient,
        uploadingFiles,
        props.uploads,
    );
    onDialogOK();
    await created;
    missionName.value = '';
    tagValues.value = {};
};
</script>
