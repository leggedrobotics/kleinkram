<template>
    <CategorySelector
        :selected="selected"
        :project-uuid="file.mission?.project?.uuid"
        @update:selected="updateSelected"
        @update:creating="updateCreating"
    />
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';

import type { CategoryDto } from '@kleinkram/api-dto/types/category.dto';

import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import CategorySelector from 'components/category-selector.vue';

const emit = defineEmits(['update:selected', 'update:creating']);
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

const updateCreating = (creating: boolean): void => {
    emit('update:creating', creating);
};

const updateSelected = (value: CategoryDto[]): void => {
    selected.value = value;
};
</script>

<style scoped></style>
