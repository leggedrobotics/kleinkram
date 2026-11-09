<template>
    <q-chip
        dense
        size="sm"
        color="green-1"
        text-color="green-9"
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
.public-project-chip {
    vertical-align: middle;
}
</style>
