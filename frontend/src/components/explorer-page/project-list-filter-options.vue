<template>
    <div class="project-filter-options">
        <div class="project-filter-options__scope">
            <my-projects-selector
                v-if="myProjects !== undefined"
                v-model="myProjects"
                class="self-stretch"
            />
        </div>

        <div class="project-filter-options__search">
            <app-search-bar
                v-model="search"
                placeholder="Search by Project Name"
            />
        </div>

        <div class="project-filter-options__actions">
            <app-refresh-button @click="resetCache" />

            <dialog-opener-create-project>
                <app-create-button
                    :label="$q.screen.xs ? 'Create' : 'Create Project'"
                    aria-label="Create Project"
                />
            </dialog-opener-create-project>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import DialogOpenerCreateProject from 'components/button-wrapper/dialog-opener-create-project.vue';
import AppCreateButton from 'components/common/app-create-button.vue';
import AppRefreshButton from 'components/common/app-refresh-button.vue';
import AppSearchBar from 'components/common/app-search-bar.vue';
import MyProjectsSelector from 'components/explorer-page/my-projects-selector.vue';
import { useHandler } from 'src/hooks/query-hooks';
import { ref, watch } from 'vue';

const myProjects = defineModel<boolean>();
const queryClient = useQueryClient();
const handler = useHandler();

const search = ref(handler.value.searchParams.name);

async function resetCache(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
}

watch([myProjects, search], () => {
    handler.value.setSearch({ name: search.value ?? '' });
    // TODO: fix that we need a timeout here!!!
    setTimeout(() => {
        resetCache().catch(() => ({}));
    });
});
</script>

<style scoped>
/*
 * Desktop keeps the original layout: the scope selector on the left, the
 * search field and the action buttons pushed to the right.
 */
.project-filter-options {
    display: flex;
    align-items: center;
    gap: 10px;
}

.project-filter-options__scope {
    margin-right: auto;
}

.project-filter-options__actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

/*
 * Below 1024px the search field claims a full row of its own and the
 * remaining controls wrap onto a second row with comfortable touch targets.
 */
@media (max-width: 1023px) {
    .project-filter-options {
        flex-wrap: wrap;
        gap: 8px;
    }

    .project-filter-options__search {
        order: -1;
        flex: 1 0 100%;
        min-width: 0;
    }

    .project-filter-options__scope {
        margin-right: 0;
    }

    .project-filter-options__actions {
        flex-wrap: wrap;
        gap: 8px;
    }

    .project-filter-options__scope :deep(.q-btn),
    .project-filter-options__actions :deep(.q-btn) {
        min-height: 40px;
        min-width: 40px;
    }

    .project-filter-options__search :deep(.q-field .q-field__control),
    .project-filter-options__search :deep(.q-field .q-field__marginal) {
        height: 40px;
        min-height: 40px;
    }
}
</style>
