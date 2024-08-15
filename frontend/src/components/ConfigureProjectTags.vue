<template>
    <h5>Add & remove Tagtypes</h5>
    <ConfigureTags v-model:selected="selected" v-if="project" />
    <div class="row q-ma-md">
        <div class="col-10" />
        <div class="col-2">
            <q-btn label="Save" color="primary" @click="() => mutate()" />
        </div>
    </div>
</template>
<script setup lang="ts">
import { getProject } from 'src/services/queries/project';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ref, watch } from 'vue';
import ConfigureTags from 'components/ConfigureTags.vue';
import { TagType } from 'src/types/TagType';
import { updateTagTypes } from 'src/services/mutations/project';
import { Notify } from 'quasar';

const props = defineProps<{
    projectUUID: string;
}>();

const queryClient = useQueryClient();

const { data: project } = useQuery({
    queryKey: ['project', props.projectUUID],
    queryFn: async () => {
        return getProject(props.projectUUID);
    },
});
const selected = ref<TagType[]>([]);

watch(
    () => project.value,
    (newVal) => {
        selected.value = newVal?.requiredTags || ([] as TagType[]);
    },
    { immediate: true },
);
const { mutate } = useMutation({
    mutationFn: () => {
        return updateTagTypes(
            project.value?.uuid as string,
            selected.value.map((tag) => tag.uuid),
        );
    },
    onSuccess(data, variables, context) {
        Notify.create({
            message: 'Tagtypes updated',
            color: 'positive',
        });
        queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] === 'project' &&
                query.queryKey[1] === props.projectUUID,
        });
    },
    onError(error, variables, context) {
        Notify.create({
            message: 'Error adding TagTypes: ' + error.message,
            color: 'negative',
        });
    },
});
</script>
<style scoped></style>
