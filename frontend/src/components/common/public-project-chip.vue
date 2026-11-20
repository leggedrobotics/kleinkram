<template>
    <q-chip
        dense
        size="sm"
        text-color="primary"
        icon="sym_o_public"
        class="text-weight-medium q-px-sm public-project-chip"
    >
        {{ label }}
        <q-tooltip>
            Public project: every Kleinkram user can view and download it
        </q-tooltip>
    </q-chip>
</template>

<script setup lang="ts">
const { label = 'Public' } = defineProps<{ label?: string }>();
</script>

<style scoped>
/* neutral grey tag ($tag-background-gray / $tag-color-gray) */
.public-project-chip {
    vertical-align: middle;
    background: #e0e0e0;
}
</style>
