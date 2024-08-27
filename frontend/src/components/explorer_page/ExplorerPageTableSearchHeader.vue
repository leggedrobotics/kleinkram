<template>
    <div>
        <br v-if="handler.isListingFiles" />

        <q-select
            v-if="handler.isListingFiles"
            v-model="_filetype"
            :options="[FileType.BAG, FileType.MCAP]"
            label="File Type"
            outlined
            dense
        />
    </div>
</template>

<script setup lang="ts">
import { QueryHandler } from 'src/services/QueryHandler';
import { FileType } from 'src/enums/FILE_ENUM';
import { computed } from 'vue';

const props = defineProps({
    handler: QueryHandler,
});

const _filetype = computed({
    get: (): FileType => props.handler.file_type || FileType.BAG,
    set: (value: FileType) => {
        props.handler?.setFileType(value);
    },
});

const type = computed(() => {
    if (props.handler.isListingProjects) {
        return 'Project';
    } else if (props.handler.isListingMissions) {
        return 'Mission';
    } else if (props.handler.isListingFiles) {
        return 'File';
    }
});
</script>
