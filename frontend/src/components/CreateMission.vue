<template>
    <q-card-section>
        <h3 class="text-h6">Create new mission</h3>
        <div class="row justify-between q-gutter-md">
            <div class="col-5">
                <q-form @submit="submitNewMission">
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
                </q-form>
            </div>
            <div class="col-2">
                <q-btn
                    label="Submit"
                    color="primary"
                    @click="submitNewMission"
                />
            </div>
        </div>
    </q-card-section>
</template>

<script setup lang="ts">
import { ref, Ref } from 'vue';
import { Project } from 'src/types/types';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { allProjects } from 'src/services/queries';
import { createMission } from 'src/services/mutations';
import { Notify } from 'quasar';
const queryClient = useQueryClient();

const selected_project: Ref<Project | null> = ref(null);
const missionName = ref('');
const ddr_open = ref(false);
const { isLoading, isError, data, error } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: allProjects,
});

const props = defineProps<{
    project?: Project;
}>();

if (props.project) {
    selected_project.value = props.project;
}
const submitNewMission = async () => {
    if (!selected_project.value) {
        return;
    }
    await createMission(missionName.value, selected_project.value.uuid);
    const cache = queryClient.getQueryCache();
    console.log(cache.getAll());
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
};
</script>

<style scoped></style>
