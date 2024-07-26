<template>
    <q-card-section>
        <h3 class="text-h6">Create new project</h3>
        <div class="row justify-between q-gutter-md">
            <div class="col-9">
                <q-form @submit="submitNewProject">
                    <div class="row justify-between">
                        <div class="col-3">
                            <q-input
                                v-model="projectName"
                                label="Project Name"
                                outlined
                                dense
                                clearable
                                required
                            />
                        </div>
                        <div class="col-3">
                            <q-input
                                v-model="projectDescription"
                                label="Project Description"
                                type="textarea"
                                autogrow
                                :rows="4"
                                outlined
                                dense
                                clearable
                            />
                        </div>
                        <div class="col-5">
                            <q-select
                                v-model="selectedTags"
                                label="Select Tags"
                                outlined
                                dense
                                clearable
                                multiple
                                use-chips
                                :options="data"
                                emit-value
                                map-options
                                class="full-width"
                                option-label="name"
                                option-value="uuid"
                            />
                        </div>
                    </div>
                </q-form>
            </div>
            <div class="col-2">
                <q-btn
                    label="Submit"
                    color="primary"
                    @click="submitNewProject"
                    :disable="!projectName"
                />
            </div>
        </div>
    </q-card-section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { TagType } from 'src/types/TagType';
import { getTagTypes } from 'src/services/queries/tag';
import { createProject } from 'src/services/mutations/project';

const projectName = ref('');
const projectDescription = ref('');
const queryClient = useQueryClient();
const selectedTags = ref([]);

const { isLoading, data, error } = useQuery<TagType[]>({
    queryKey: ['tagTypes'],
    queryFn: getTagTypes,
});

const submitNewProject = async () => {
    try {
        await createProject(
            projectName.value,
            projectDescription.value,
            selectedTags.value,
        );
    } catch (error) {
        console.log(error);
        Notify.create({
            message: `Error creating project: ${error?.response?.data?.message || error.message}`,
            color: 'negative',
            spinner: false,
            timeout: 4000,
            position: 'top-right',
        });
        return;
    }
    const cache = queryClient.getQueryCache();
    const filtered = cache
        .getAll()
        .filter((query) => query.queryKey[0] === 'projects');
    filtered.forEach((query) => {
        queryClient.invalidateQueries(query.queryKey);
    });
    Notify.create({
        message: `Project ${projectName.value} created`,
        color: 'positive',
        spinner: false,
        timeout: 4000,
        position: 'top-right',
    });
    projectName.value = '';
    projectDescription.value = '';
};
</script>
<style scoped></style>
