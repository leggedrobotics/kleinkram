<template>
    <span v-if="file" class="text-grey-6 text-caption q-ml-md">
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

defineProps<{
    file?: FileEventDto['file'];
}>();
</script>
