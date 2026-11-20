<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="isPending"
        size="lg"
        :dirty="dirty"
    >
        <template #title>Required Metadata</template>

        <template #content>
            <ConfigureMetadata v-if="project" v-model:selected="selected" />
        </template>

        <template #actions>
            <q-btn
                flat
                no-caps
                label="Save Changes"
                class="bg-button-primary"
                :loading="isPending"
                @click="saveAction"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { MetadataTypeDto } from '@kleinkram/api-dto/types/metadata/metadata.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import ConfigureMetadata from 'components/configure-metadata.vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useProjectQuery } from 'src/hooks/query-hooks';
import { getDialogErrorMessage } from 'src/services/error-handling';
import { updateProjectMetadataTypes } from 'src/services/mutations/project';
import { computed, ref, watch } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { projectUUID } = defineProps<{ projectUUID: string }>();

const queryClient = useQueryClient();

const { data: project } = useProjectQuery(projectUUID);
const selected = ref<MetadataTypeDto[]>([]);
const errorMessage = ref('');

const selectedUuids = (types: MetadataTypeDto[]): string =>
    JSON.stringify(types.map((type) => type.uuid).toSorted());
const dirty = computed(
    () =>
        !!project.value &&
        selectedUuids(selected.value) !==
            selectedUuids(project.value.requiredMetadataTypes),
);

watch(
    () => project.value,
    (newValue) => {
        selected.value =
            newValue?.requiredMetadataTypes ?? ([] as MetadataTypeDto[]);
    },
    { immediate: true },
);
const { mutate, isPending } = useMutation({
    mutationFn: () => {
        return updateProjectMetadataTypes(
            project.value?.uuid ?? '',
            selected.value.map((metadataType) => metadataType.uuid),
        );
    },
    async onSuccess() {
        Notify.create({
            message: 'Required metadata updated',
            color: 'positive',
            position: 'bottom',
        });
        await queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] === 'project' &&
                query.queryKey[1] === projectUUID,
        });
        onDialogOK();
    },
    onError(error) {
        errorMessage.value = getDialogErrorMessage(error);
    },
});

const saveAction = (): void => {
    if (isPending.value) return;
    errorMessage.value = '';
    mutate();
};
</script>
<style scoped></style>
