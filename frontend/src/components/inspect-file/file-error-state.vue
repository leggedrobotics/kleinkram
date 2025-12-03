<template>
    <div
        class="text-center q-pa-xl bg-grey-1 rounded-borders border-dashed text-grey-7"
    >
        <div v-if="file.state === FileState.CORRUPTED">
            <q-icon name="sym_o_broken_image" size="4em" class="q-mb-md" />
            <div class="text-h6">File is Corrupted</div>
            <div class="text-caption q-mt-xs">
                The file content does not match the expected format for
                <span class="text-weight-bold">.{{ fileExtension }}</span>
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
import { FileDto } from '@api/types/file/file.dto';
import { FileState } from '@common/enum';
import { computed } from 'vue';

const props = defineProps<{
    file: FileDto;
}>();

const fileExtension = computed(
    () => props.file.filename?.split('.').pop()?.toLowerCase() ?? '',
);
</script>

<style scoped>
.border-dashed {
    border: 2px dashed #e0e0e0;
}
</style>
