<template>
    <q-btn
        flat
        round
        dense
        :icon="isStarred ? 'sym_o_star' : 'sym_o_star_border'"
        :class="{ 'project-star-button--starred': isStarred }"
        :color="isStarred ? 'amber-8' : 'grey-7'"
        :disable="isPending"
        :aria-label="isStarred ? 'Remove star' : 'Star project'"
        :aria-pressed="isStarred"
        @click.stop="toggle"
    >
        <q-tooltip>
            {{ isStarred ? 'Remove star' : 'Star project' }}
        </q-tooltip>
    </q-btn>
</template>

<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { starProject, unstarProject } from 'src/services/mutations/project';
import { ref, watch } from 'vue';

const { projectUuid, starred } = defineProps<{
    projectUuid: string;
    starred: boolean;
}>();

const queryClient = useQueryClient();

/**
 * The button flips immediately and only falls back to the server state if the
 * request fails: waiting for the round trip plus the list refetch makes a
 * single click feel unresponsive.
 */
const isStarred = ref(starred);
watch(
    () => starred,
    (value) => {
        isStarred.value = value;
    },
);

const { mutate, isPending } = useMutation({
    mutationFn: (next: boolean) =>
        next ? starProject(projectUuid) : unstarProject(projectUuid),
    onError: (_error, next) => {
        isStarred.value = !next;
    },
    onSettled: async () => {
        // The star shows up in the project lists, in the starred dashboard
        // panel and on the project page, all of which cache their own copy of
        // the project.
        await queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] === 'project' ||
                query.queryKey[0] === 'projects' ||
                query.queryKey[0] === 'starredProjects',
        });
    },
});

function toggle(): void {
    const next = !isStarred.value;
    isStarred.value = next;
    mutate(next);
}
</script>

<style scoped>
/*
 * The filled star of the icon font is only rendered when the glyph is
 * requested in its filled variant.
 */
.project-star-button--starred :deep(.q-icon) {
    font-variation-settings: 'FILL' 1;
}
</style>
