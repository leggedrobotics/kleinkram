<template>
    <div class="starred-container dashboard-card">
        <q-card class="full-width q-pa-md header-row" flat>
            <span style="font-size: larger">Starred projects</span>
            <q-btn
                flat
                icon="sym_o_arrow_outward"
                class="scroll-button"
                aria-label="Show all starred projects"
                @click="toStarredProjects"
            >
                <q-tooltip>Show all starred projects</q-tooltip>
            </q-btn>
        </q-card>

        <q-separator />

        <q-list v-if="projects.length > 0" separator class="project-list">
            <q-item
                v-for="project in projects"
                :key="project.uuid"
                v-ripple
                clickable
                class="project-list-item"
                @click="() => goToProject(project.uuid)"
            >
                <q-item-section>
                    <q-item-label lines="1">{{ project.name }}</q-item-label>
                    <q-item-label caption lines="1">
                        {{ project.description }}
                    </q-item-label>
                </q-item-section>
                <q-item-section side>
                    <project-star-button
                        :project-uuid="project.uuid"
                        :starred="project.isStarred"
                    />
                </q-item-section>
            </q-item>
        </q-list>

        <div v-else class="empty-state-wrapper">
            <div class="empty-state-content">
                <q-icon name="sym_o_star_border" size="lg" color="grey-6" />
                <span class="text-h6 text-grey-7 q-mt-md">
                    No starred projects
                </span>
                <span class="text-body1 text-grey-6 q-mt-sm">
                    Star a project to pin it here.
                </span>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { ProjectWithRequiredMetadataTypesDto } from '@kleinkram/api-dto/types/project/project-with-required-metadata-types.dto';
import type { ProjectsDto } from '@kleinkram/api-dto/types/project/projects.dto';
import { useQuery } from '@tanstack/vue-query';
import ProjectStarButton from 'components/common/project-star-button.vue';
import ROUTES from 'src/router/routes';
import { starredProjects } from 'src/services/queries/project';
import { computed, type ComputedRef } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

/**
 * The panel is a shortcut, not a browser: it shows the first few starred
 * projects and links to the (filterable) project list for the rest.
 */
const STARRED_PANEL_SIZE = 10;

const { data } = useQuery<ProjectsDto | undefined>({
    queryKey: ['starredProjects', STARRED_PANEL_SIZE],
    queryFn: () => starredProjects(STARRED_PANEL_SIZE),
});

const projects: ComputedRef<ProjectWithRequiredMetadataTypesDto[]> = computed(
    () => data.value?.data ?? [],
);

const toStarredProjects = async (): Promise<void> => {
    await router.push({
        name: ROUTES.PROJECTS.routeName,
        query: { scope: 'starred' },
    });
};

async function goToProject(uuid: string): Promise<void> {
    await router.push(`/project/${uuid}/missions`);
}
</script>

<style scoped>
.starred-container {
    grid-column: span 1;
    background-color: white;
    display: grid;
    grid-template-rows: 50px 2px auto;
    min-height: 0;
}

.header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.project-list {
    min-height: 0;
    overflow-y: auto;
}

.project-list-item {
    min-height: 48px;
}

.empty-state-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;
    padding: 16px;
}

.empty-state-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
}
</style>
