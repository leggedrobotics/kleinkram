<template>
    <base-dialog ref="dialogRef">
        <template #title> Configure Enforced Metadata</template>

        <template #content>
            <ConfigureMetadata v-if="project" v-model:selected="selected" />
        </template>

        <template #actions>
            <ButtonGroup>
                <CreateMetadataTypeDialogOpener>
                    <q-btn
                        class="button-border"
                        flat
                        color="primary"
                        icon="sym_o_sell"
                        label="Create Metadata"
                    />
                </CreateMetadataTypeDialogOpener>

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
import type { MetadataTypeDto } from '@kleinkram/api-dto/types/metadata/metadata.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import CreateMetadataTypeDialogOpener from 'components/button-wrapper/dialog-opener-create-metadata-type.vue';
import ButtonGroup from 'components/buttons/button-group.vue';
import ConfigureMetadata from 'components/configure-metadata.vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useProjectQuery } from 'src/hooks/query-hooks';
import { updateProjectMetadataTypes } from 'src/services/mutations/project';
import { ref, watch } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { projectUUID } = defineProps<{ projectUUID: string }>();

const queryClient = useQueryClient();

const { data: project } = useProjectQuery(projectUUID);
const selected = ref<MetadataTypeDto[]>([]);

watch(
    () => project.value,
    (newValue) => {
        selected.value =
            newValue?.requiredMetadataTypes ?? ([] as MetadataTypeDto[]);
    },
    { immediate: true },
);
const { mutate } = useMutation({
    mutationFn: () => {
        return updateProjectMetadataTypes(
            project.value?.uuid ?? '',
            selected.value.map((metadataType) => metadataType.uuid),
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
            message: `Error updating enforced metadata: ${error.message}`,
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
