<template>
    <q-banner
        v-if="is_dev_instance"
        inline-actions
        class="text-white bg-red"
        style="margin: 10px 0"
    >
        <template #avatar>
            <q-icon
                name="sym_o_warning"
                color="white"
                style="font-weight: bold; font-size: 36px; padding: 2px"
            />
        </template>
        <span>
            This app is the development version of Kleinkram. Data may be lost
            at any time.
        </span>
    </q-banner>
</template>

<script setup lang="ts">
import ENV from '../../env';

// TODO: currently, all hosted versions should show this warning
const is_dev_instance = ENV.ENDPOINT.includes('.dev.leggedrobotics.com');
</script>
