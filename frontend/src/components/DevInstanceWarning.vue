<template>
    <q-banner
        inline-actions
        class="text-white bg-red"
        style="margin: 10px 0"
        v-if="is_dev_instance"
    >
        <template #avatar>
            <q-icon
                name="sym_o_warning"
                color="white"
                style="font-weight: bold; font-size: 36px; padding: 2px"
            />
        </template>
        <span>
            This app is in active development. Data will be reset without
            notice!
        </span>
    </q-banner>
</template>

<script setup lang="ts">
import ENV from 'src/env';

// TODO: currently, all hosted versions should show this warning
const is_dev_instance = ENV.ENDPOINT.includes('.leggedrobotics.com');
</script>
