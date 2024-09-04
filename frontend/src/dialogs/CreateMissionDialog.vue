<template>
    <base-dialog title="New Mission" ref="dialogRef">
        <template #title> New Mission</template>

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
                />
                <q-tab name="upload" label="Upload Data" style="color: #222" />
            </q-tabs>
        </template>
        <template #content>
            <q-tab-panels v-model="tab_selection">
                <q-tab-panel name="meta_data" style="min-height: 280px">
                    <label for="projectDescription">Project*</label>
                    <q-btn-dropdown
                        v-model="ddr_open"
                        :disable="!!props?.project_uuid"
                        :label="project?.name || 'Project'"
                        class="q-uploader--bordered full-width full-height q-mb-lg"
                        flat
                        clearable
                        required
                    >
                        <q-list>
                            <q-item
                                v-for="_project in !!all_projects
                                    ? all_projects[0]
                                    : []"
                                :key="_project.uuid"
                                clickable
                                @click="
                                    project_uuid = _project.uuid;
                                    ddr_open = false;
                                "
                            >
                                <q-item-section>
                                    <q-item-label>
                                        {{ _project.name }}
                                    </q-item-label>
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-btn-dropdown>

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
                </q-tab-panel>
                <q-tab-panel name="tags" style="min-height: 280px">
                    <q-btn-dropdown
                        label="Add Tag"
                        class="q-uploader--bordered full-width full-height q-mb-lg"
                        flat
                        clearable
                        required
                        :disabled="availableAdditionalTags.length === 0"
                    >
                        <q-list>
                            <q-item
                                v-for="tagtype in availableAdditionalTags"
                                :key="tagtype.uuid"
                                clickable
                                @click="() => addTag(tagtype)"
                            >
                                <q-item-section>
                                    <q-item-label>
                                        {{ tagtype.name }}
                                    </q-item-label>
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-btn-dropdown>

                    <template
                        v-for="tagtype in [
                            ...(project?.requiredTags ?? []),
                            ...additonalTags,
                        ]"
                        :key="tagtype.uuid"
                        class="row q-gutter-sm"
                    >
                        <label>
                            Tag: {{ tagtype.name }}

                            <template
                                v-if="
                                    (project?.requiredTags ?? [])
                                        .map((t) => t.name)
                                        .includes(tagtype.name)
                                "
                            >
                                *
                            </template>
                        </label>

                        <q-input
                            v-if="tagtype.type !== DataType.BOOLEAN"
                            v-model="tagValues[tagtype.uuid]"
                            :placeholder="tagtype.name"
                            outlined
                            dense
                            clearable
                            required
                            style="padding-bottom: 30px"
                            :type="DataType_InputType[tagtype.type] || 'text'"
                        />
                        <q-field
                            v-if="tagtype.type === DataType.BOOLEAN"
                            :rules="[
                                (val) =>
                                    val === true ||
                                    val === false ||
                                    'Please select a value',
                            ]"
                            color="black"
                            dense
                            outlined
                            style="padding-bottom: 30px"
                            v-model="tagValues[tagtype.uuid]"
                        >
                            <q-toggle
                                v-model="tagValues[tagtype.uuid]"
                                :label="
                                    tagValues[tagtype.uuid] === undefined
                                        ? '-'
                                        : tagValues[tagtype.uuid]
                                          ? 'True'
                                          : 'False'
                                "
                                outlined
                                dense
                                required
                                flat
                                style="padding-bottom: 30px"
                                :type="
                                    DataType_InputType[tagtype.type] || 'text'
                                "
                                :options="[
                                    { label: 'True', value: true },
                                    { label: 'False', value: false },
                                ]"
                            />
                        </q-field>
                    </template>
                </q-tab-panel>
                <q-tab-panel name="upload" style="min-width: 280px">
                    <CreateFile
                        v-if="newMission"
                        :mission="newMission"
                        ref="createFileRef"
                    />
                </q-tab-panel>
            </q-tab-panels>
        </template>

        <template #actions>
            <q-btn
                v-if="tab_selection === 'meta_data'"
                flat
                label="Next"
                :disable="!missionName"
                @click="tab_selection = 'tags'"
                class="bg-button-primary"
            />
            <q-btn
                v-if="tab_selection === 'tags'"
                flat
                label="Create Mission"
                class="bg-button-primary"
                @click="
                    () => {
                        submitNewMission();
                    }
                "
            />
            <q-btn
                v-if="tab_selection === 'upload'"
                flat
                label="Upload & Exit"
                class="bg-button-primary"
                @click="
                    () => {
                        createFileRef?.createFileAction().then(() => {
                            onDialogOK();
                        });
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
import { DataType } from 'src/enums/TAG_TYPES';
import { Project } from 'src/types/Project';
import { TagType } from 'src/types/TagType';
import { filteredProjects, getProject } from 'src/services/queries/project';
import { getTagTypes } from 'src/services/queries/tag';
import { createMission } from 'src/services/mutations/mission';
import CreateFile from 'components/CreateFile.vue';
import { Mission } from 'src/types/Mission';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const tab_selection = ref('meta_data');
const createFileRef = ref<InstanceType<typeof CreateFile> | null>(null);

const props = defineProps<{
    project_uuid: string | undefined;
}>();

const project_uuid = ref(props.project_uuid);
const newMission: Ref<Mission | undefined> = ref(undefined);
const queryClient = useQueryClient();

const { data: project, refetch } = useQuery<Project>({
    queryKey: computed(() => ['project', project_uuid]),
    queryFn: () => getProject(project_uuid.value as string),
    enabled: computed(() => !!project_uuid.value),
});

// we load the new project if the project_uuid changes
watch(project_uuid, () => refetch());

const missionName = ref('');
const isInErrorState = ref(false);
const errorMessage = ref('');
const ddr_open = ref(false);

const { data: all_projects } = useQuery<[Project[], number]>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name'),
});

const DataType_InputType = {
    [DataType.STRING]: 'text',
    [DataType.NUMBER]: 'number',
    [DataType.BOOLEAN]: 'checkbox',
    [DataType.DATE]: 'date',
    [DataType.LOCATION]: 'text',
};

const tagValues: Ref<Record<string, string>> = ref({});

const { data: tagTypes } = useQuery<TagType[]>({
    queryKey: ['tagTypes'],
    queryFn: getTagTypes,
});
const availableAdditionalTags: Ref<TagType[]> = computed(() => {
    if (!tagTypes.value) return [];
    let usedTagUUIDs: string[] = [];
    if (project.value) {
        usedTagUUIDs = project.value.requiredTags.map((tag) => tag.uuid);
    }
    const addedTagUUIDs = additonalTags.value.map((tag) => tag.uuid);
    console.log('usedTagUUIDs', usedTagUUIDs);
    return tagTypes.value?.filter(
        (tagtype) =>
            !usedTagUUIDs.includes(tagtype.uuid) &&
            !addedTagUUIDs.includes(tagtype.uuid),
    );
});

const additonalTags: Ref<TagType[]> = ref<TagType[]>([]);

const submitNewMission = async () => {
    if (!project.value) {
        return;
    }
    const resp = await createMission(
        missionName.value,
        project.value.uuid,
        tagValues.value,
    ).catch((e) => {
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
        position: 'top-right',
    });
    missionName.value = '';
    tagValues.value = {};
    tab_selection.value = 'upload';
};

function addTag(tagtype: TagType) {
    additonalTags.value.push(tagtype);
}
</script>
