<template>
    <q-item-section avatar class="q-pr-none" style="min-width: 30px">
        <q-icon
            :name="getEventIcon(type)"
            size="xs"
            :color="getEventColor(type)"
        />
    </q-item-section>
</template>

<script setup lang="ts">
import { FileEventType } from '@common/enum';
import { getEventColor, getEventIcon } from './utilities';

defineProps<{
    type: FileEventType;
}>();
</script>
