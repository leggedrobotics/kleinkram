<template>
    <div>
        <div v-if="readme" class="row items-center q-mb-sm text-grey-8">
            <q-icon name="sym_o_description" size="18px" class="q-mr-xs" />
            <router-link
                :to="{
                    name: ROUTES.FILE.routeName,
                    params: {
                        projectUuid,
                        missionUuid,
                        file_uuid: readme.uuid,
                    },
                }"
                class="text-grey-8"
            >
                {{ readme.filename }}
            </router-link>
        </div>

        <div
            v-if="isContentLoading"
            class="row items-center q-gutter-sm text-grey-7 q-pa-md"
        >
            <q-spinner-dots size="1.5em" />
            <span>Loading README...</span>
        </div>

        <div v-else-if="contentError" class="text-negative q-pa-md">
            <q-icon name="sym_o_warning" /> Could not load the README.
        </div>

        <MarkdownViewer
            v-else-if="content"
            :content="content.text"
            :truncated="content.truncated"
        />
    </div>
</template>

<script setup lang="ts">
import type { FileDto } from '@kleinkram/api-dto/types/file/file.dto';
import MarkdownViewer from 'components/inspect-file/viewers/markdown-viewer.vue';
import { useReadmeContent } from 'src/composables/use-mission-readme';
import { useMissionUUID, useProjectUUID } from 'src/hooks/router-hooks';
import ROUTES from 'src/router/routes';
import { toRef } from 'vue';

const properties = defineProps<{
    readme: FileDto | undefined;
}>();

// Loaded here rather than on the page: the panel only mounts while Mission
// Info is the active tab, so other tabs never download the README.
const {
    content,
    isLoading: isContentLoading,
    error: contentError,
} = useReadmeContent(toRef(properties, 'readme'));

const projectUuid = useProjectUUID();
const missionUuid = useMissionUUID();
</script>
