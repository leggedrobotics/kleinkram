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
import type { ProjectScope } from 'src/types/project-scope';
import { ref } from 'vue';

const scope = ref<ProjectScope>('all');
</script>
