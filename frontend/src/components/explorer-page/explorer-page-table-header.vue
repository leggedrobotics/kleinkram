<template>
    <div>
        <template v-if="urlHandler.isListingMissions">
            <h2 class="text-h6 q-mb-xs explorer-table-header__title">
                Explore all Missions of Project
            </h2>
            <HelpMessage
                text="You can only see missions on which you have at least view access on project level or mission level."
                link="https://docs.datasets.leggedrobotics.com/usage/getting-started.html"
            />
        </template>

        <template v-if="urlHandler.isListingFiles">
            <h2 class="text-h6 q-mb-xs explorer-table-header__title">
                Explore all Files of Mission
            </h2>
            <HelpMessage
                text="You can only see files of missions you have access to."
                link="https://docs.datasets.leggedrobotics.com/usage/getting-started.html"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
import HelpMessage from 'components/help-message.vue';
import { QueryHandler } from 'src/services/query-handler';
defineProps({
    urlHandler: {
        type: QueryHandler,
        required: true,
    },
});
</script>

<style scoped>
/* Keep the heading readable, and wrapping, on narrow screens */
.explorer-table-header__title {
    overflow-wrap: anywhere;
}

@media (max-width: 599px) {
    .explorer-table-header__title {
        font-size: 1rem;
        font-weight: 500;
        line-height: 1.5rem;
        letter-spacing: 0.00937em;
    }
}
</style>
