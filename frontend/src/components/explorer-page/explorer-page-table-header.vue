<template>
    <div>
        <template v-if="url_handler.isListingMissions">
            <h2 class="text-h6 q-mb-xs">Explore all Missions of Project</h2>
            <HelpMessage
                text="You can only see missions on which you have at least view access on project level or mission level."
                link="https://docs.datasets.leggedrobotics.com/usage/getting-started.html"
            />
        </template>

        <template v-if="url_handler.isListingFiles">
            <h2 class="text-h6 q-mb-xs">Explore all Files of Mission</h2>
            <HelpMessage
                text="You can only see files of missions you have access to."
                link="https://docs.datasets.leggedrobotics.com/usage/getting-started.html"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
import { QueryHandler } from '../../services/query-handler';
import HelpMessage from '@components/help-message.vue';
defineProps({
    url_handler: {
        type: QueryHandler,
        required: true,
    },
});
</script>
