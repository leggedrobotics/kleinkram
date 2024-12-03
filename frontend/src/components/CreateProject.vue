<template>
    <q-card-section>
        <h3 class="text-h6">Create new project</h3>
        <q-form style="width: 100%" @submit="submitNewProject">
            <div class="row justify-between q-gutter-md">
                <div class="col-9">
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
                                required
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
                                :options="data !== undefined ? data.tags : []"
                                emit-value
                                map-options
                                class="full-width"
                                option-label="name"
                                option-value="uuid"
                            />
                        </div>
                    </div>
                </div>
                <div class="col-2">
                    <q-btn label="Submit" color="primary" type="submit" />
                </div>
            </div>
        </q-form>
    </q-card-section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { createProject } from 'src/services/mutations/project';
import { useAllTags } from '../hooks/customQueryHooks';

const projectName = ref('');
const projectDescription = ref('');
const queryClient = useQueryClient();
const selectedTags = ref([]);

const { data } = useAllTags();

const submitNewProject = async () => {
    try {
        await createProject(
            projectName.value,
            projectDescription.value,
            selectedTags.value,
            [],
            [],
        );
    } catch (error: unknown) {
        const errorMessages: string = (error as Error).message;

        Notify.create({
            message: `Error creating project: ${errorMessages}`,
            color: 'negative',
            spinner: false,
            timeout: 4000,
            position: 'bottom',
        });
        return;
    }
    await queryClient.invalidateQueries({
        predicate: (query) =>
            query.queryKey[0] === 'projects' ||
            query.queryKey[0] === 'permissions',
    });

    Notify.create({
        message: `Project ${projectName.value} created`,
        color: 'positive',
        spinner: false,
        timeout: 4000,
        position: 'bottom',
    });
    projectName.value = '';
    projectDescription.value = '';
};
</script>
<style scoped></style>
