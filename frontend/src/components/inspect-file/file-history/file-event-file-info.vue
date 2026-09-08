<template>
    <span
        v-if="file"
        class="text-grey-6 text-caption file-event-file-info"
        :class="$q.screen.xs ? 'q-ml-none' : 'q-ml-md'"
    >
        File:
        <span v-if="file.projectName"> {{ file.projectName }} / </span>
        <span v-if="file.missionName"> {{ file.missionName }} / </span>
        {{ file.filename }}
        <router-link
            :to="{
                name: 'FilePage',
                params: {
                    projectUuid: file.projectUuid,
                    missionUuid: file.missionUuid,
                    file_uuid: file.uuid,
                },
            }"
            class="text-primary hover-underline"
            style="text-decoration: none"
            @click.stop
        >
            <q-icon name="sym_o_open_in_new" size="xs" />
        </router-link>
    </span>
</template>

<script setup lang="ts">
import type { FileEventDto } from '@kleinkram/api-dto/types/file/file-event.dto';
import { useQuasar } from 'quasar';

defineProps<{
    file?: FileEventDto['file'];
}>();

const $q = useQuasar();
</script>

<style scoped>
.file-event-file-info {
    overflow-wrap: anywhere;
}
</style>
