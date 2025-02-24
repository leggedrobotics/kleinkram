<template>
    <q-banner
        v-if="isDevInstance"
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
// eslint-disable-next-line unicorn/prevent-abbreviations
import ENV from '../../environment';

// TODO: currently, all hosted versions should show this warning
// eslint-disable-next-line unicorn/prevent-abbreviations
const isDevInstance = ENV.ENDPOINT.includes('.dev.leggedrobotics.com');
</script>
