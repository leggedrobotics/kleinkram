<template>
    <base-dialog ref="dialogRef" title="New Mission">
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
                        ref="missionNameInput"
                        v-model="missionName"
                        name="missionName"
                        outlined
                        required
                        clearable
                        autofocus
                        dense
                        placeholder="Name...."
                        style="padding-bottom: 30px"
                        :error="isInErrorState"
                        :error-message="errorMessage"
                        @update:model-value="onModelValueUpdate"
                    />
                    <input
                        ref="HTMLinput"
                        type="file"
                        webkitdirectory
                        style="display: none"
                        @change="handle"
                    />
                    <q-file
                        v-model="files"
                        outlined
                        style="min-width: 300px"
                        @click="transferClick"
                    >
                        <template #prepend>
                            <q-icon name="sym_o_attach_file" />
                        </template>

                        <template #append>
                            <q-icon name="sym_o_cancel" @click="onCancel" />
                        </template>
                    </q-file>
                </q-tab-panel>
                <q-tab-panel name="tags" style="min-height: 280px">
                    <SelectMissionTags
                        :tag-values="tagValues"
                        :project-u-u-i-d="project.uuid"
                        @update:tag-values="onTagValueUpdate"
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
                class="bg-button-primary"
                @click="goToTagTab"
            />
            <q-btn
                v-if="tab_selection === 'tags'"
                flat
                label="Create Mission"
                class="bg-button-primary"
                :disable="!allRequiredTagsSet"
                @click="submitNewMission"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { computed, ref, Ref, watch } from 'vue';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { Notify, QInput, useDialogPluginComponent } from 'quasar';
import { useQueryClient } from '@tanstack/vue-query';
import { createMission } from 'src/services/mutations/mission';
import SelectMissionTags from 'components/SelectMissionTags.vue';
import { createFileAction } from 'src/services/fileService';
import { MissionDto } from '@api/types/Mission.dto';
import { FileUploadDto } from '@api/types/Upload.dto';
import { useProjectQuery } from '../hooks/customQueryHooks';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const tab_selection = ref('meta_data');

const props = defineProps<{
    project_uuid: string | undefined;
    uploads: Ref<FileUploadDto[]>;
}>();

const HTMLinput = ref();
const project_uuid = ref(props.project_uuid);
const newMission: Ref<MissionDto | undefined> = ref(undefined);
const queryClient = useQueryClient();
const files = ref<File[]>([]);

const { data: project, refetch } = useProjectQuery(project_uuid);

// we load the new project if the project_uuid changes
watch(project_uuid, () => refetch());

const missionName = ref('');
const isInErrorState = ref(false);
const errorMessage = ref('');
const uploadingFiles = ref<Record<string, Record<string, string>>>({});

const tagValues: Ref<Record<string, string>> = ref({});

const allRequiredTagsSet = computed(() => {
    return project.value.requiredTags.every(
        (tag) => tagValues.value[tag.uuid] !== '',
    );
});

const missionCreated = computed(() => {
    return !!newMission.value;
});

const handle = (a: any): void => {
    files.value = a.target.files;
    if (files.value.length > 0) {
        missionName.value = files.value[0].webkitRelativePath.split('/')[0];
    }
};

function transferClick(e: any): void {
    e.preventDefault();
    HTMLinput.value.click();
}

const submitNewMission = async () => {
    if (project.value === undefined) {
        return;
    }
    const resp = await createMission(
        missionName.value,
        project.value.uuid,
        tagValues.value,
    ).catch((e: unknown) => {
        tab_selection.value = 'meta_data';
        isInErrorState.value = true;
        if (e instanceof Error) {
            errorMessage.value = e.response.data.message;
        }
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
                query.queryKey[1] === project.value.uuid,
        );
    await Promise.all(
        filtered.map((query) => {
            console.log('Invalidating query', query.queryKey);
            return queryClient.invalidateQueries({
                queryKey: query.queryKey,
            });
        }),
    );
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

const goToTagTab = (): void => {
    tab_selection.value = 'tags';
};

const onModelValueUpdate = (): void => {
    isInErrorState.value = false;
};

const onCancel = (): void => {
    files.value = [];
};

const onTagValueUpdate = (update: Record<string, string>): void => {
    tagValues.value = update;
};
</script>
