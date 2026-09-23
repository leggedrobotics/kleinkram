<template>
    <q-icon
        :name="icon"
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

const icon = computed(() => {
    switch (properties.type) {
        case AccessGroupType.PRIMARY: {
            return 'sym_o_person';
        }
        case AccessGroupType.PUBLIC: {
            return 'sym_o_public';
        }
        default: {
            return 'sym_o_group';
        }
    }
});
</script>
