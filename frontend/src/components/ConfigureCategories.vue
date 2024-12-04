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

import CategorySelector from 'components/CategorySelector.vue';

import CategoryCreator from 'components/CategoryCreator.vue';
import { CategoryDto } from '@api/types/Category.dto';

import { FileDto } from '@api/types/files/file.dto';

const emit = defineEmits(['update:selected']);
const props = defineProps<{
    file: FileDto;
}>();

const selected = ref<CategoryDto[]>(props.file.categories);

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
