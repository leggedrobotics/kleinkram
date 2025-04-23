<template>
    <CategorySelector
        :selected="selected"
        :project-uuid="file.mission?.project?.uuid"
        @update:selected="updateSelected"
    />
    <CategoryCreator :project-uuid="file.mission?.project?.uuid" />
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';

import { CategoryDto } from '@api/types/category.dto';

import { FileWithTopicDto } from '@api/types/file/file.dto';
import CategorySelector from 'components/category-selector.vue';
import CategoryCreator from 'components/category-creator.vue';

const emit = defineEmits(['update:selected']);
const { file } = defineProps<{
    file: FileWithTopicDto;
}>();

const selected = ref<CategoryDto[]>(file.categories);

watch(
    () => selected.value,
    (value) => {
        emit('update:selected', value);
    },
);

const updateSelected = (value: CategoryDto[]): void => {
    selected.value = value;
};
</script>

<style scoped></style>
