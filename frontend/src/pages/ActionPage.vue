<template>
    <title-section title="Mission Analysis"></title-section>

    <q-drawer
        side="right"
        v-model="createAction"
        :width="496"
        style="bottom: 0 !important"
        :breakpoint="1000"
        bordered
    >
        <div class="q-pa-lg flex row justify-between" style="height: 84px">
            <h3 class="text-h4 q-ma-none">Submit new Action</h3>
            <q-btn
                flat
                dense
                padding="6px"
                class="button-border"
                icon="sym_o_close"
                @click="() => (createAction = false)"
            />
        </div>

        <q-separator />

        <div class="q-pa-lg">
            <span class="help-text">
                Actions are used to verify mission data or to generate derived
                files.
            </span>

            <!-- Select a project and mission, on which the anylsis will be performed -->
            <q-form
                @submit.prevent="submitAnalysis"
                class="flex column"
                style="margin-top: 24px"
            >
                <span class="text-h5">Basic Information</span>
                <div class="flex column" style="gap: 12px; margin-top: 16px">
                    <div>
                        <label for="action_name">Action Name</label>
                        <q-select
                            v-model="select"
                            label="Select a Template or name a new one. (Confirm with Enter)"
                            :options="actionTemplatesRes"
                            use-input
                            input-debounce="20"
                            outlined
                            dense
                            clearable
                            class="full-width"
                            @new-value="newValue"
                            @input-value="filter = $event"
                            @update:model-value="selectTemplate($event)"
                        >
                            <template v-slot:selected>
                                <div v-if="select && select.name">
                                    {{ select.name }}&Tab;v{{ select.version }}
                                </div>
                            </template>
                            <template v-slot:option="scope">
                                <q-item v-bind="scope.itemProps">
                                    <q-item-section>
                                        <q-item-label>{{
                                            scope.opt.name
                                        }}</q-item-label>
                                        <q-item-label caption
                                            >v{{
                                                scope.opt.version
                                            }}</q-item-label
                                        >
                                    </q-item-section>
                                </q-item>
                            </template>
                        </q-select>
                    </div>

                    <div>
                        <label for="project">Project</label>
                        <q-select
                            name="project"
                            :model-value="selected_project?.name"
                            :options="projects"
                            option-label="name"
                            option-value="uuid"
                            placeholder="Project"
                            outlined
                            dense
                            class="q-mb-sm"
                            style="background-color: #f4f4f4"
                            @update:model-value="
                                (a) => handler.setProjectUUID(a.uuid)
                            "
                        />
                    </div>
                    <div>
                        <label for="mission">Mission</label>
                        <q-select
                            :model-value="selected_mission?.name"
                            :options="missions"
                            option-label="name"
                            placeholder="Mission"
                            name="mission"
                            outlined
                            dense
                            class="q-mb-sm"
                            style="background-color: #f4f4f4"
                            @update:model-value="
                                (a) => handler.setMissionUUID(a.uuid)
                            "
                        />
                    </div>
                </div>
                <span class="text-h5" style="margin-top: 32px"
                    >Define the Action</span
                >
                <div class="flex column" style="gap: 12px; margin-top: 16px">
                    <div>
                        <label for="docker_image">Define the Action</label>
                        <q-input
                            name="docker_image"
                            v-model="editingTemplate.image.name"
                            outlined
                            dense
                            class="q-mb-sm"
                            clearable
                            placeholder="Docker Image"
                        />
                    </div>

                    <div>
                        <label for="action_trigger">Define the Action</label>

                        <q-input
                            name="action_trigger"
                            model-value="Manually Triggered"
                            outlined
                            readonly
                            dense
                            class="q-mb-sm"
                            clearable
                            placeholder="Action Trigger"
                        />
                    </div>

                    <div>
                        <label for="action_command">Command</label>
                        <q-input
                            name="action_command"
                            v-model="editingTemplate.command"
                            outlined
                            dense
                            class="q-mb-sm"
                            clearable
                            placeholder="Command"
                        />
                    </div>
                </div>

                <span class="text-h5" style="margin-top: 32px">
                    Compute Resources
                </span>
                <div
                    class="flex column q-mb-lg"
                    style="gap: 12px; margin-top: 16px"
                >
                    <div>
                        <label for="memory">Memory Allocation</label>
                        <q-select
                            name="memory"
                            model-value="2GB RAM"
                            :options="[]"
                            placholder="Memory Allocation"
                            outlined
                            class="q-mb-sm"
                            readonly
                            dense
                        />
                    </div>
                    <div>
                        <label for="cpu">CPU Core Allocation</label>
                        <q-select
                            name="cpu"
                            model-value="2 Cores"
                            :options="[]"
                            label="CPU Core Allocation"
                            outlined
                            class="q-mb-sm"
                            readonly
                            dense
                        />
                    </div>
                    <div>
                        <label for="gpu">GPU Acceleration</label>
                        <q-select
                            name="gpu"
                            v-model="
                                editingTemplate.runtime_requirements.gpu_model
                                    .name
                            "
                            :options="options"
                            option-value="value"
                            option-label="label"
                            label="GPU Acceleration"
                            class="q-mb-sm"
                            map-options
                            outlined
                            dense
                        />
                    </div>
                </div>

                <q-separator />

                <div class="flex row justify-end q-mt-lg">
                    <q-btn
                        flat
                        @click="() => saveAsTemplate()"
                        class="bg-button-secondary text-on-color q-mx-sm"
                        label="Save as Template"
                        :disable="!isModified"
                    />
                    <q-btn
                        flat
                        @click="submitAnalysis"
                        class="bg-button-secondary text-on-color"
                        label="Submit Action"
                    />
                </div>
            </q-form>
        </div>
    </q-drawer>

    <div class="q-my-lg">
        <div class="flex justify-between items-center">
            <button-group>
                <q-btn-dropdown
                    v-model="dropdownNewFileProject"
                    :label="selected_project?.name || 'Select a Project'"
                    flat
                    class="q-uploader--bordered"
                    clearable
                    required
                >
                    <q-list>
                        <q-item
                            v-for="project in projects"
                            :key="project.uuid"
                            clickable
                            @click="handler.setProjectUUID(project.uuid)"
                        >
                            <q-item-section>
                                <q-item-label>
                                    {{ project.name }}
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
                <q-btn-dropdown
                    v-model="dropdownNewFileMission"
                    :label="selected_mission?.name || 'Select a Mission'"
                    class="q-uploader--bordered"
                    flat
                    clearable
                    required
                >
                    <q-list>
                        <q-item
                            v-for="mission in missions"
                            :key="mission.uuid"
                            clickable
                            @click="handler.setMissionUUID(mission.uuid)"
                        >
                            <q-item-section>
                                <q-item-label>
                                    {{ mission.name }}
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
            </button-group>

            <button-group>
                <q-input
                    debounce="300"
                    placeholder="Search"
                    dense
                    v-model="search"
                    disabled
                    outlined
                >
                    <template v-slot:append>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>

                <q-btn
                    flat
                    dense
                    padding="6px"
                    color="icon-secondary"
                    class="button-border"
                    icon="sym_o_loop"
                    disabled=""
                >
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>

                <q-btn
                    flat
                    class="bg-button-secondary text-on-color"
                    label="Create Action"
                    @click="() => (createAction = true)"
                    icon="sym_o_add"
                />
            </button-group>
        </div>
    </div>

    <div>
        <template v-if="selected_project && selected_mission">
            <ActionsTable :handler="handler"></ActionsTable>
        </template>
        <template v-else>
            <div class="text">Please select a project and a mission to...</div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, Ref, ref, watch } from 'vue';

import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import ActionsTable from 'components/Actions.vue';
import { Project } from 'src/types/Project';
import { Mission } from 'src/types/Mission';
import { filteredProjects } from 'src/services/queries/project';
import { missionsOfProject } from 'src/services/queries/mission';
import {
    createActionTemplate,
    createAnalysis,
    createNewActionTemplateVersion,
} from 'src/services/mutations/action';
import ButtonGroup from 'components/ButtonGroup.vue';
import { useHandler } from 'src/hooks/customQueryHooks';
import TitleSection from 'components/TitleSection.vue';
import { listActionTemplates } from 'src/services/queries/action';
import { ActionTemplate } from 'src/types/ActionTemplate';

const search = ref('');
const createAction = ref(false);

const select: Ref<undefined | ActionTemplate> = ref(undefined);
const filter = ref('');
const image_name = ref('rslethz/action:latest');
const options = [
    { label: 'no GPU', value: 'no-gpu' },
    { label: 'GPU needed', value: 'GPU needed' },
];
const queryClient = useQueryClient();

const editingTemplate = ref(
    new ActionTemplate(
        '',
        null,
        null,
        null,
        { name: 'rslethz/action:latest' },
        null,
        '',
        1,
        '',
        { gpu_model: { name: options[0].value } },
    ),
);

const dropdownNewFileProject = ref(false);
const dropdownNewFileMission = ref(false);

const handler = useHandler();

const selected_project = computed(() =>
    projects.value.find(
        (project: Project) => project.uuid === handler.value.project_uuid,
    ),
);

const selected_mission = computed(() =>
    missions.value.find(
        (mission: Mission) => mission.uuid === handler.value.mission_uuid,
    ),
);

const actionTemplateKey = computed(() => ['actionTemplates', filter.value]);
const { data: actionTemplatesRes } = useQuery({
    queryKey: actionTemplateKey,
    queryFn: () => listActionTemplates(filter.value),
});

async function saveAsTemplate() {
    let res: undefined;
    if (isModified.value && editingTemplate.value.uuid) {
        res = await updateTemplate(true);
    } else {
        res = await createTemplate(true);
    }
    editingTemplate.value = res;
    select.value = res.clone();
}

const { mutateAsync: createTemplate } = useMutation({
    mutationFn: (searchable: boolean) =>
        createActionTemplate({
            name: editingTemplate.value.name,
            command: editingTemplate.value.command,
            docker_image: editingTemplate.value.image.name,
            gpu_model:
                editingTemplate.value.runtime_requirements.gpu_model.name,
            searchable,
        }),
    onSuccess: () => {
        queryClient.invalidateQueries({
            predicate: (query) => {
                return query.queryKey[0] === 'actionTemplates';
            },
        });
        Notify.create({
            group: false,
            message: 'Template created',
            color: 'positive',
            position: 'bottom',
            timeout: 2000,
        });
    },
    onError: (error) => {
        Notify.create({
            group: false,
            message: `Error: ${error.response.data.message}`,
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
    },
});

const { mutateAsync: updateTemplate } = useMutation({
    mutationFn: (searchable: boolean) =>
        createNewActionTemplateVersion({
            uuid: editingTemplate.value.uuid,
            name: editingTemplate.value.name,
            command: editingTemplate.value.command,
            docker_image: editingTemplate.value.image.name,
            gpu_model:
                editingTemplate.value.runtime_requirements.gpu_model.name,
            searchable,
        }),
    onSuccess: (newVal) => {
        queryClient.invalidateQueries({
            predicate: (query) => {
                return query.queryKey[0] === 'actionTemplates';
            },
        });
        Notify.create({
            group: false,
            message: `Template updated: ${newVal.name} v${newVal.version}`,
            color: 'positive',
            position: 'bottom',
            timeout: 2000,
        });
    },
    onError: (error) => {
        Notify.create({
            group: false,
            message: `Error: ${error.response.data.message}`,
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
    },
});

// Fetch projects
const projectsReturn = useQuery<[Project[], number]>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name', false),
});
const projects = computed(() =>
    projectsReturn.data.value ? projectsReturn.data.value[0] : [],
);

const isModified = computed(() => {
    const sameName = editingTemplate.value.name === select.value?.name;
    const sameImage =
        editingTemplate.value.image.name === select.value?.image.name;
    const sameCommand = editingTemplate.value.command === select.value?.command;
    const sameGPU =
        editingTemplate.value.runtime_requirements.gpu_model.name ===
        select.value?.runtime_requirements.gpu_model.name;

    return !(sameName && sameImage && sameCommand && sameGPU);
});

function newValue(val: string, done: Function) {
    const existingTemplate = actionTemplatesRes.value.find(
        (template: ActionTemplate) => template.name === val,
    );
    if (existingTemplate) {
        editingTemplate.value = existingTemplate.clone();
        select.value = existingTemplate;
    }
    editingTemplate.value.name = val;
    done(editingTemplate);
}

// Fetch missions
const queryKeyMissions = computed(() => [
    'missions',
    handler.value.project_uuid,
]);
const { data: _missions } = useQuery<[Mission[], number]>({
    queryKey: queryKeyMissions,
    queryFn: () => missionsOfProject(handler.value.project_uuid || '', 500, 0),
});
const missions = computed(() => (_missions.value ? _missions.value[0] : []));

async function submitAnalysis() {
    console.log(
        `Submit new action: ${selected_project.value?.uuid}, ${selected_mission.value?.uuid}, ${image_name.value}`,
    );

    // validate input (this will also be performed on the backend)
    // the user must select a project and a mission
    // the image name must start with 'rslethz/'
    if (!selected_project.value || !selected_mission.value) {
        Notify.create({
            group: false,
            message: 'Please select a project and a mission',
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
        return;
    }
    if (!editingTemplate.value.image.name.startsWith('rslethz/')) {
        Notify.create({
            group: false,
            message: 'The image name must start with "rslethz/"',
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
        return;
    }

    // post: the input should be valid now
    let res = editingTemplate.value;

    if (isModified.value && editingTemplate.value.uuid) {
        res = await updateTemplate(false);
    } else if (!editingTemplate.value.uuid) {
        res = await createTemplate(false);
    }
    editingTemplate.value = res;
    select.value = res.clone();
    // send the action request to the backend and show a notification
    createAnalysis({
        missionUUID: selected_mission.value.uuid,
        templateUUID: res.uuid,
    })
        .then((res) => {
            Notify.create({
                group: false,
                message: 'Analysis submitted',
                color: 'positive',
                position: 'bottom',
                timeout: 2000,
            });
        })
        .catch((error) => {
            Notify.create({
                group: false,
                message: `Error: ${error}`,
                color: 'negative',
                position: 'bottom',
                timeout: 2000,
            });
        });
}
function selectTemplate(template: ActionTemplate) {
    if (!template) {
        editingTemplate.value = new ActionTemplate(
            '',
            null,
            null,
            null,
            { name: 'rslethz/action:latest' },
            null,
            '',
            1,
            '',
            { gpu_model: { name: options[0].value } },
        );
        select.value = undefined;
        return;
    }
    if (template.hasOwnProperty('_rawValue')) {
        return;
    }
    editingTemplate.value = template.clone();
}
</script>
