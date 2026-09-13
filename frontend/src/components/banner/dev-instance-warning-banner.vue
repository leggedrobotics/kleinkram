<template>
    <q-banner
        v-if="isDevInstance"
        inline-actions
        class="text-white bg-red dev-instance-banner"
    >
        <template #avatar>
            <q-icon name="sym_o_warning" color="white" />
        </template>
        <span>
            This app is the development version of Kleinkram. Data may be lost
            at any time.
        </span>
    </q-banner>
</template>

<script setup lang="ts">
import ENV from 'src/environment';

// TODO: currently, all hosted versions should show this warning
const isDevInstance = ENV.BACKEND_URL.includes('.dev.leggedrobotics.com');
</script>

<style scoped>
.dev-instance-banner {
    margin: 10px 0;
}

/* The text must always wrap; never clip it to a fixed height */
.dev-instance-banner :deep(.q-banner__content) {
    min-height: 0;
    overflow-wrap: anywhere;
    white-space: normal;
}

.dev-instance-banner :deep(.q-banner__avatar > .q-icon) {
    font-size: 36px;
    font-weight: bold;
    padding: 2px;
}

@media (max-width: 599px) {
    .dev-instance-banner {
        padding: 8px 12px;
    }

    .dev-instance-banner :deep(.q-banner__avatar > .q-icon) {
        font-size: 26px;
    }

    /* Tighter gap between the icon and the wrapped message on phones */
    .dev-instance-banner
        :deep(.q-banner__avatar:not(:empty) + .q-banner__content) {
        padding-left: 12px;
    }
}
</style>
