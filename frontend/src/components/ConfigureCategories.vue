<template>
    <CategorySelector
        :selected="selected"
        :project_uuid="file.mission?.project?.uuid"
        @update:selected="updateSelected"
    />
    <CategoryCreator :project_uuid="props.file.mission?.project?.uuid" />
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
import { Category } from 'src/types/Category';
import { FileEntity } from 'src/types/FileEntity';

import CategorySelector from 'components/CategorySelector.vue';

import CategoryCreator from 'components/CategoryCreator.vue';

const emit = defineEmits(['update:selected']);
const props = defineProps<{
    file: FileEntity;
}>();

const selected = ref<Category[]>(props.file.categories || []);

watch(
    () => selected.value,
    (value) => {
        emit('update:selected', value);
    },
);

function updateSelected(value: Category[]) {
    selected.value = value;
}
</script>

<style scoped></style>
