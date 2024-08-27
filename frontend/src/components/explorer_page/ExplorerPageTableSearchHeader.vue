<template>
    <div>
        <br v-if="url_handler.isListingFiles" />

        <q-select
            v-if="url_handler.isListingFiles"
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
    url_handler: {
        type: QueryHandler,
        required: true,
    },
});

const _filetype = computed({
    get: (): FileType => props.url_handler.file_type || FileType.BAG,
    set: (value: FileType) => {
        props.url_handler?.setFileType(value);
    },
});

const type = computed(() => {
    if (props.url_handler.isListingProjects) {
        return 'Project';
    } else if (props.url_handler.isListingMissions) {
        return 'Mission';
    } else if (props.url_handler.isListingFiles) {
        return 'File';
    }
});
</script>
