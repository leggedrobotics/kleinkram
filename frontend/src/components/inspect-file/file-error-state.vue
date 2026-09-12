<template>
    <div
        class="text-center q-pa-xl bg-grey-1 rounded-borders border-dashed text-grey-7 file-error-state"
    >
        <div v-if="file.state === FileState.CORRUPTED">
            <q-icon name="sym_o_broken_image" size="4em" class="q-mb-md" />
            <div class="text-h6">File is Corrupted</div>
            <div class="text-caption q-mt-xs">
                The file content does not match the expected format for
                <span class="text-weight-bold">.{{ fileExtension }}</span>
            </div>

            <div v-if="file.relatedFileUuid" class="q-mt-md">
                <q-btn
                    flat
                    color="primary"
                    icon="sym_o_check_circle"
                    label="View Recovered File"
                    :to="relatedFileRoute"
                />
            </div>
            <div v-else-if="isMcap" class="q-mt-md">
                <q-btn
                    color="primary"
                    icon="sym_o_build"
                    label="Try to Recover MCAP"
                    :loading="recovering"
                    @click="recoverFile"
                />
            </div>
        </div>

        <div v-else-if="file.state === FileState.CONVERSION_ERROR">
            <q-icon name="sym_o_error" size="4em" class="q-mb-md" />
            <div class="text-h6">Conversion Failed</div>
            <div class="text-caption q-mt-xs">
                An error occurred while converting the file.
            </div>
        </div>

        <div v-else-if="file.state === FileState.ERROR">
            <q-icon name="sym_o_error" size="4em" class="q-mb-md" />
            <div class="text-h6">Processing Error</div>
            <div class="text-caption q-mt-xs">
                An unexpected error occurred during processing.
            </div>
        </div>

        <div v-else>
            <q-icon name="sym_o_description" size="4em" class="q-mb-md" />
            <div class="text-h6">No Preview Available</div>
            <div class="text-caption q-mt-xs">
                Preview not supported for
                <span class="text-weight-bold">.{{ fileExtension }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { FileDto } from '@kleinkram/api-dto/types/file/file.dto';
import { FileState, FileType } from '@kleinkram/shared';
import { useQuasar } from 'quasar';
import { recoverMcapFile } from 'src/services/mutations/file';
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

const props = defineProps<{
    file: FileDto;
}>();

const $q = useQuasar();
const route = useRoute();
const recovering = ref(false);

const fileExtension = computed(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    () => props.file.filename?.split('.').pop()?.toLowerCase() ?? '',
);

const isMcap = computed(
    () => props.file.type === FileType.MCAP || fileExtension.value === 'mcap',
);

const relatedFileRoute = computed(() => ({
    name: 'FilePage',
    params: {
        ...route.params,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        file_uuid: props.file.relatedFileUuid,
    },
}));

const recoverFile = async () => {
    recovering.value = true;
    try {
        await recoverMcapFile(props.file.uuid);
        $q.notify({
            message: 'MCAP recovery action started successfully',
            color: 'positive',
            position: 'bottom',
            timeout: 3000,
        });
    } catch (error_: unknown) {
        const error = error_ as { response?: { data?: { message?: string } } };
        $q.notify({
            message:
                error.response?.data?.message ??
                'Failed to start MCAP recovery action',
            color: 'negative',
            position: 'bottom',
            timeout: 3000,
        });
    } finally {
        recovering.value = false;
    }
};
</script>

<style scoped>
.border-dashed {
    border: 2px dashed #e0e0e0;
}

@media (max-width: 599px) {
    .file-error-state {
        padding: 32px 16px;
    }
}
</style>
