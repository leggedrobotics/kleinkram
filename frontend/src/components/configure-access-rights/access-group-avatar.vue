<template>
    <q-icon
        :name="isPrimary ? 'sym_o_person' : 'sym_o_group'"
        class="q-mr-sm bg-grey-3 p-1 rounded-circle"
        size="20px"
        style="padding: 6px; border-radius: 50%"
    />
</template>

<script setup lang="ts">
import { AccessGroupType } from '@kleinkram/shared';
import { computed } from 'vue';

const properties = defineProps<{
    type: AccessGroupType;
}>();

const isPrimary = computed(() => properties.type === AccessGroupType.PRIMARY);
</script>
