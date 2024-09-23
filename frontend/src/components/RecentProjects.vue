<template>
    <div class="projects-container">
        <!-- Static Row with Title and Arrows -->
        <q-card class="full-width q-pa-md header-row" flat style="height: 15%">
            <span style="font-size: larger">Recently used projects</span>
            <div class="arrow-buttons">
                <q-btn
                    @click="scrollLeft"
                    flat
                    icon="sym_o_arrow_back"
                    class="scroll-button"
                />
                <q-btn
                    @click="scrollRight"
                    flat
                    icon="sym_o_arrow_forward"
                    class="scroll-button"
                />
            </div>
        </q-card>

        <!-- Scrollable Card Section -->
        <div ref="cardWrapper" class="card-wrapper" style="height: 85%">
            <div class="card" v-for="project in projects" :key="project.uuid">
                <q-card
                    flat
                    style="height: 100%"
                    @click="() => goToProject(project.uuid)"
                >
                    <q-card-section class="q-mb-sm" style="max-height: 20%">
                        <h4
                            class="q-my-sm"
                            style="padding-top: 0; padding-bottom: 0"
                        >
                            {{ project.name }}
                        </h4>
                    </q-card-section>
                    <q-card-section
                        class="q-my-sm"
                        style="padding-top: 0; padding-bottom: 0; height: 50%"
                    >
                        {{ project.description }}
                    </q-card-section>
                    <q-card-section style="max-height: 30%">
                        Updated {{ timeAgo(project) }}
                    </q-card-section>
                </q-card>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, nextTick, computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { Project } from 'src/types/Project';
import { filteredProjects } from 'src/services/queries/project';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'vue-router';

const router = useRouter();

const { data } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(5, 0, 'updatedAt', true),
});

const projects = computed(() => (data.value ? data.value[0] : []));

const cardWrapper = ref<HTMLElement | null>(null);

// Function to scroll left
const scrollLeft = () => {
    if (cardWrapper.value) {
        cardWrapper.value.scrollBy({
            left: -300, // Adjust scroll distance as needed
            behavior: 'smooth',
        });
    }
};

// Function to scroll right
const scrollRight = () => {
    if (cardWrapper.value) {
        cardWrapper.value.scrollBy({
            left: 300, // Adjust scroll distance as needed
            behavior: 'smooth',
        });
    }
};

function goToProject(uuid: string) {
    router.push(`/project/${uuid}/missions`);
}

const timeAgo = (project: Project) => {
    const missionUpdated = project.missions.map((mission) => mission.updatedAt);
    const allDates = [project.updatedAt, ...missionUpdated];
    const mostRecentDate = new Date(
        Math.max(...allDates.map((date) => date.getTime())),
    );
    return formatDistanceToNow(mostRecentDate, { addSuffix: true });
};

// Use nextTick to ensure that the DOM is fully rendered and the ref is set
nextTick(() => {
    if (cardWrapper.value) {
        cardWrapper.value.style.scrollBehavior = 'smooth';
    }
});
</script>

<style scoped>
.projects-container {
    max-width: 910px; /* Adjust to fit your design */
    margin: 0 auto;
    position: relative;
    max-height: 350px;
}

.header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 3px; /* Spacing between header and cards */
}

.arrow-buttons {
    display: flex;
    gap: 8px;
}

.card-wrapper {
    display: flex;
    gap: 3px; /* Spacing between cards */
    overflow-x: auto; /* Enable horizontal scrolling */
    height: 100%;
    margin-top: 0;
    padding-top: 0;
    scrollbar-width: none;
}

.card {
    flex: 0 0 300px; /* Fixed width of the card */
    min-width: 300px; /* Prevent card from shrinking */
    max-height: 100%;
}

.scroll-button {
    z-index: 1;
}
</style>
