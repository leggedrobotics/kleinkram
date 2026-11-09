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
                    name="details"
                    label="Mission Details*"
                    style="color: #222"
                    :disable="missionCreated"
                />
                <q-tab
                    name="metadata"
                    :label="
                        'Metadata' +
                        (!!project && project.requiredMetadataTypes.length > 0
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
                <q-tab-panel name="details" style="min-height: 280px">
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
                        style="width: 100%"
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
                <q-tab-panel name="metadata" style="min-height: 280px">
                    <SelectMissionMetadata
                        :metadata-values="metadataValues"
                        :project-uuid="project?.uuid ?? ''"
                        @update:metadata-values="onMetadataValuesUpdate"
                    />
                </q-tab-panel>
            </q-tab-panels>
        </template>

        <template #actions>
            <q-btn
                v-if="tab_selection === 'details'"
                flat
                label="Next"
                :disable="missionName.length < 3"
                class="bg-button-primary"
                @click="goToMetadataTab"
            />
            <q-btn
                v-if="tab_selection === 'metadata'"
                flat
                label="Create Mission"
                class="bg-button-primary"
                :disable="!allRequiredMetadataSet"
                @click="submitNewMission"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { FlatMissionDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import type { FileUploadDto } from '@kleinkram/api-dto/types/upload.dto';
import { useQueryClient } from '@tanstack/vue-query';
import SelectMissionMetadata from 'components/select-mission-metadata.vue';
import { Notify, QInput, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useProjectQuery } from 'src/hooks/query-hooks';
import { createFileAction } from 'src/services/file-service';
import { createMission } from 'src/services/mutations/mission';
import { computed, ref, Ref, watch } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

// eslint-disable-next-line @typescript-eslint/naming-convention
const tab_selection = ref('details');

const properties = defineProps<{
    projectUuid: string | undefined;
    uploads: Ref<FileUploadDto[]>;
}>();

const HTMLinput = ref();
const projectUuid = ref(properties.projectUuid);
const newMission: Ref<FlatMissionDto | undefined> = ref(undefined);
const queryClient = useQueryClient();
const files = ref<File[]>([]);

const { data: project, refetch } = useProjectQuery(projectUuid);

// we load the new project if the projectUuid changes
watch(projectUuid, () => refetch());

const missionName = ref('');
const isInErrorState = ref(false);
const errorMessage = ref('');
const uploadingFiles = ref<Record<string, Record<string, string>>>({});

const metadataValues: Ref<Record<string, string>> = ref({});

const allRequiredMetadataSet = computed(() => {
    return project.value?.requiredMetadataTypes.every(
        (metadataType) =>
            metadataValues.value[metadataType.uuid] !== undefined &&
            metadataValues.value[metadataType.uuid] !== '',
    );
});

const missionCreated = computed(() => {
    return !!newMission.value;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handle = (a: any): void => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    files.value = a.target.files;
    if (files.value.length > 0) {
        missionName.value =
            files.value[0]?.webkitRelativePath.split('/')[0] ?? '';
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transferClick(event: any): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    event.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    HTMLinput.value.click();
}

const submitNewMission = async () => {
    if (project.value === undefined) {
        return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const resp = await createMission(
        missionName.value,
        project.value.uuid,
        metadataValues.value,
    ).catch((error: unknown) => {
        tab_selection.value = 'details';
        isInErrorState.value = true;
        errorMessage.value =
            (
                error as {
                    response?: { data?: { message?: string } };
                }
            ).response?.data?.message ?? '';
    });

    // exit if the request failed
    if (resp === undefined) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    newMission.value = resp;
    // @ts-ignore
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
            // eslint-disable-next-line no-console
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
        newMission.value ?? undefined,
        newMission.value?.project ?? undefined,
        [...files.value].filter(
            (file: File) =>
                file.name.endsWith('.bag') || file.name.endsWith('.mcap'),
        ),
        queryClient,
        uploadingFiles,
        // @ts-ignore
        properties.uploads,
    );
    onDialogOK();
    await created;
    missionName.value = '';
    metadataValues.value = {};
};

const goToMetadataTab = (): void => {
    tab_selection.value = 'metadata';
};

const onModelValueUpdate = (): void => {
    isInErrorState.value = false;
};

const onCancel = (): void => {
    files.value = [];
};

const onMetadataValuesUpdate = (update: Record<string, string>): void => {
    metadataValues.value = update;
};
</script>
