<template>
    <title-section title="Projects" />

    <div :class="$q.screen.xs ? 'q-my-md' : 'q-my-lg'">
        <project-list-filter-options v-model="scope" />

        <div style="padding-top: 10px">
            <explorer-page-project-table :scope="scope" />
        </div>
    </div>
</template>
<script setup lang="ts">
import ExplorerPageProjectTable from 'components/explorer-page/explorer-page-project-table.vue';
import ProjectListFilterOptions from 'components/explorer-page/project-list-filter-options.vue';
import TitleSection from 'components/title-section.vue';
import { parseProjectScope, type ProjectScope } from 'src/types/project-scope';
import { ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

/**
 * The scope is seeded from the `scope` query parameter so that a link can open
 * the list on a given slice — the dashboard's starred panel links to
 * `?scope=starred`.
 *
 * It is deliberately read once and never written back: `QueryURLHandler`
 * rebuilds the whole query string from the state it knows about whenever the
 * list is sorted or paged, so a `scope` parameter would be dropped on the next
 * interaction. Keeping it in a local ref means the chosen scope survives that,
 * at the cost of not being restored on a reload.
 */
const scope = ref<ProjectScope>(parseProjectScope(route.query.scope));
</script>
