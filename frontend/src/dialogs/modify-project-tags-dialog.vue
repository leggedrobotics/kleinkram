<template>
    <base-dialog ref="dialogRef">
        <template #title> Configure Project Tags</template>

        <template #content>
            <ConfigureMetadata v-if="project" v-model:selected="selected" />
        </template>

        <template #actions>
            <ButtonGroup>
                <CreateTagTypeDialogOpener>
                    <q-btn
                        class="button-border"
                        flat
                        color="primary"
                        icon="sym_o_sell"
                        label="Add Tag Type"
                    />
                </CreateTagTypeDialogOpener>

                <q-btn
                    flat
                    label="Save"
                    class="bg-button-primary"
                    @click="saveAction"
                />
            </ButtonGroup>
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from './base-dialog.vue';
import { getProject } from 'src/services/queries/project';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ref, watch } from 'vue';
import { updateTagTypes } from 'src/services/mutations/project';
import { TagDto } from '@api/types/tags/TagsDto.dto';
import CreateTagTypeDialogOpener from '../components/button-wrapper/CreateTagTypeDialogOpener.vue';
import ButtonGroup from '../components/ButtonGroup.vue';
import ConfigureMetadata from '../components/ConfigureMetadata.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const properties = defineProps<{
    projectUUID: string;
}>();

const queryClient = useQueryClient();

const { data: project } = useQuery({
    queryKey: ['project', properties.projectUUID],
    queryFn: async () => {
        return getProject(properties.projectUUID);
    },
});
const selected = ref<TagDto[]>([]);

watch(
    () => project.value,
    (newValue) => {
        selected.value = newValue?.requiredTags || ([] as TagDto[]);
    },
    { immediate: true },
);
const { mutate } = useMutation({
    mutationFn: () => {
        return updateTagTypes(
            project.value?.uuid ?? '',
            selected.value.map((tag) => tag.uuid),
        );
    },
    async onSuccess() {
        Notify.create({
            message: 'Tagtypes updated',
            color: 'positive',
            position: 'bottom',
        });
        await queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] === 'project' &&
                query.queryKey[1] === properties.projectUUID,
        });
    },
    onError(error) {
        Notify.create({
            message: `Error adding TagTypes: ${error.message}`,
            color: 'negative',
            position: 'bottom',
        });
    },
});

const saveAction = (): void => {
    mutate();
    onDialogOK();
};
</script>
<style scoped></style>
