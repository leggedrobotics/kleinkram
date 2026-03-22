<template>
    <q-chip
        :color="isExpired(props.expirationDate) ? 'negative' : 'positive'"
        text-color="white"
        dense
        class="text-weight-bold q-px-sm"
        size="sm"
    >
        {{ isExpired(props.expirationDate) ? 'Expired' : 'Active' }}
    </q-chip>
</template>

<script setup lang="ts">
import { isExpired } from 'src/services/date-formating';

const props = defineProps<{
    expirationDate?: string | Date | null | undefined;
}>();
</script>
