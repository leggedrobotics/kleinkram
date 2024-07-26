<template>
    <q-page class="flex">
        <div class="q-pa-md">
            <div class="text-h4">Mission Details Page</div>
            <vue-json-pretty :data="data" />
        </div>
    </q-page>
</template>

<script setup lang="ts">
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';

// print the id of the action mission (extracted from the route)
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { actionDetails } from 'src/services/queries/action';

const $route = useRoute();

const { data } = useQuery({
    queryKey: ['missions_action', $route.params.id],
    queryFn: () => actionDetails($route.params.id as string),
});
</script>
