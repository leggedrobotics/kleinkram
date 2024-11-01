<template>
    <base-dialog ref="dialogRef">
        <template #title> Configure Project Tags</template>

        <template #content>
            <ConfigureTags v-model:selected="selected" v-if="project" />
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
                    @click="
                        () => {
                            mutate();
                            onDialogOK();
                        }
                    "
                />
            </ButtonGroup>
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import ConfigureTags from 'components/ConfigureTags.vue';
import { getProject } from 'src/services/queries/project';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ref, watch } from 'vue';
import { TagType } from 'src/types/TagType';
import { updateTagTypes } from 'src/services/mutations/project';
import CreateTagTypeDialogOpener from 'components/buttonWrapper/CreateTagTypeDialogOpener.vue';
import ButtonGroup from 'components/ButtonGroup.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

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
            position: 'bottom',
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
            position: 'bottom',
        });
    },
});
</script>
<style scoped></style>
