<template>
    <q-table
        :rows="rows"
        :columns="columns"
        row-key="uuid"
        wrap-cells
        flat
        bordered
        :filter="filter"
        @row-click="handleRowClick"
    />
</template>

<script setup lang="ts">
import { TagTypeDto } from '@api/types/tags/tags.dto';
import { defineEmits, defineProps } from 'vue';

defineProps<{ rows: TagTypeDto[]; columns: any[]; filter: string }>();

const emit = defineEmits(['row-selected']);

const handleRowClick = (event: Event, row: TagTypeDto): void => {
    emit('row-selected', row);
};
</script>
