<template>
    <title-section title="Projects" />

    <div class="q-my-lg">
        <project-list-filter-options v-model="myProjects" />

        <div style="padding-top: 10px">
            <explorer-page-project-table :my-projects="myProjects" />
        </div>
    </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import ExplorerPageProjectTable from 'components/explorer-page/explorer-page-project-table.vue';
import TitleSection from 'components/title-section.vue';
import ProjectListFilterOptions from 'components/explorer-page/project-list-filter-options.vue';

const myProjects = ref(false);
</script>
