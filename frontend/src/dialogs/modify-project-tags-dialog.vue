<template>
    <base-dialog ref="dialogRef">
        <template #title> Configure Enforced Metadata</template>

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
                        label="Create Metadata"
                    />
                </CreateTagTypeDialogOpener>

                <q-btn
                    flat
                    label="Save Changes"
                    class="bg-button-primary"
                    @click="saveAction"
                />
            </ButtonGroup>
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { TagTypeDto } from '@api/types/tags/tags.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import CreateTagTypeDialogOpener from 'components/button-wrapper/dialog-opener-create-tag-type.vue';
import ButtonGroup from 'components/buttons/button-group.vue';
import ConfigureMetadata from 'components/configure-metadata.vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useProjectQuery } from 'src/hooks/query-hooks';
import { updateTagTypes } from 'src/services/mutations/project';
import { ref, watch } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { projectUUID } = defineProps<{ projectUUID: string }>();

const queryClient = useQueryClient();

const { data: project } = useProjectQuery(projectUUID);
const selected = ref<TagTypeDto[]>([]);

watch(
    () => project.value,
    (newValue) => {
        selected.value = newValue?.requiredTags ?? ([] as TagTypeDto[]);
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
            message: 'Enforced Metadata updated',
            color: 'positive',
            position: 'bottom',
        });
        await queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] === 'project' &&
                query.queryKey[1] === projectUUID,
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
