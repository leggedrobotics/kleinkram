<template>
    <q-card-section>
        <h3 class="text-h6">Create new mission</h3>
        <q-form @submit="submitNewMission">
            <div class="row justify-between q-gutter-md">
                <div class="col-5">
                    <div class="row items-center justify-between q-gutter-md">
                        <div class="col-5">
                            <q-input
                                v-model="missionName"
                                label="Mission Name"
                                outlined
                                dense
                                clearable
                                required
                            />
                        </div>
                        <div class="col-4">
                            <q-btn-dropdown
                                v-model="ddr_open"
                                :label="selected_project?.name || 'Project'"
                                outlined
                                dense
                                clearable
                                required
                            >
                                <q-list>
                                    <q-item
                                        v-for="project in data"
                                        :key="project.uuid"
                                        clickable
                                        @click="
                                            selected_project = project;
                                            ddr_open = false;
                                        "
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
                    </div>
                </div>
            </div>
            <div
                v-for="tagtype in [
                    ...(project?.requiredTags ?? []),
                    ...additonalTags,
                ]"
                :key="tagtype.uuid"
                class="row q-gutter-sm"
            >
                <div class="col-3 flex flex-center">
                    <div class="text-bold q-pa-md" style="width: 100%">
                        {{ tagtype.name }}
                    </div>
                </div>
                <div class="col-3 flex-center flex">
                    <q-input
                        v-if="tagtype.type !== DataType.BOOLEAN"
                        v-model="tagValues[tagtype.uuid]"
                        :label="tagtype.name"
                        outlined
                        dense
                        clearable
                        required
                        :type="DataType_InputType[tagtype.type] || 'text'"
                        style="width: 100%"
                    />
                    <q-field
                        v-if="tagtype.type === DataType.BOOLEAN"
                        :rules="[
                            (val) =>
                                val === true ||
                                val === false ||
                                'Please select a value',
                        ]"
                        style="width: 100%"
                        color="black"
                        dense
                        outlined
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
                            :type="DataType_InputType[tagtype.type] || 'text'"
                            style="width: 100%"
                            :options="[
                                { label: 'True', value: true },
                                { label: 'False', value: false },
                            ]"
                        />
                    </q-field>
                </div>
            </div>
            <div class="row">
                <div class="col-3">
                    <q-btn-dropdown label="Add another tag">
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
                </div>
            </div>
            <div class="row">
                <div class="col-10"></div>
                <div class="col-2">
                    <q-btn label="Submit" color="primary" type="submit" />
                </div>
            </div>
        </q-form>
    </q-card-section>
</template>

<script setup lang="ts">
import { computed, ref, Ref, watch } from 'vue';
import { Project, TagType } from 'src/types/types';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { allProjects, getProject, getTagTypes } from 'src/services/queries';
import { createMission } from 'src/services/mutations';
import { Notify } from 'quasar';
import { DataType } from 'src/enum/TAG_TYPES';
const queryClient = useQueryClient();

const selected_project: Ref<Project | null> = ref(null);
const missionName = ref('');
const ddr_open = ref(false);
const { isLoading, isError, data, error } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: allProjects,
});
const DataType_InputType = {
    [DataType.STRING]: 'text',
    [DataType.NUMBER]: 'number',
    [DataType.BOOLEAN]: 'checkbox',
    [DataType.DATE]: 'date',
    [DataType.LOCATION]: 'text',
};

const props = defineProps<{
    project?: Project;
}>();
const tagValues: Ref<Record<string, string>> = ref({});

if (props.project) {
    selected_project.value = props.project;
}
const { data: tagTypes } = useQuery<TagType[]>({
    queryKey: ['tagTypes'],
    queryFn: getTagTypes,
});
const { data: project } = useQuery<Project>({
    queryKey: computed(() => ['project', selected_project.value?.uuid]),
    queryFn: () => getProject(selected_project.value?.uuid as string),
    enabled: computed(() => !!selected_project.value?.uuid),
});

const availableAdditionalTags: Ref<TagType[]> = computed(() => {
    if (!tagTypes.value) return [];
    if (!project.value) return tagTypes.value;
    const usedTagUUIDs = project.value.requiredTags.map((tag) => tag.uuid);
    const addedTagUUIDs = additonalTags.value.map((tag) => tag.uuid);
    return tagTypes.value?.filter(
        (tagtype) =>
            !usedTagUUIDs.includes(tagtype.uuid) &&
            !addedTagUUIDs.includes(tagtype.uuid),
    );
});

const additonalTags: Ref<TagType[]> = ref<TagType[]>([]);
watch(selected_project, (newVal) => {
    if (!newVal) {
        return;
    }
});
const submitNewMission = async () => {
    if (!selected_project.value) {
        return;
    }
    await createMission(
        missionName.value,
        selected_project.value.uuid,
        tagValues.value,
    );
    const cache = queryClient.getQueryCache();
    const filtered = cache
        .getAll()
        .filter(
            (query) =>
                query.queryKey[0] === 'missions' &&
                query.queryKey[1] === selected_project.value?.uuid,
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
};

function addTag(tagtype: TagType) {
    additonalTags.value.push(tagtype);
}
</script>

<style scoped></style>
