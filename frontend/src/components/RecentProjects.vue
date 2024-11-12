<template>
    <div class="projects-container">
        <!-- Static Row with Title and Arrows -->
        <q-card class="full-width q-pa-md header-row" flat>
            <span style="font-size: larger">Recently used projects</span>
            <div class="arrow-buttons">
                <q-btn
                    @click="scrollLeft"
                    :disable="!canScrollLeft"
                    flat
                    icon="sym_o_arrow_back"
                    class="scroll-button"
                />
                <q-btn
                    @click="scrollRight"
                    :disable="!canScrollRight"
                    flat
                    icon="sym_o_arrow_forward"
                    class="scroll-button"
                />
            </div>
        </q-card>

        <q-separator />

        <!-- Scrollable Card Section -->
        <div ref="cardWrapper" class="card-wrapper" @scroll="checkScroll">
            <template v-for="project in projects" :key="project.uuid">
                <div class="card">
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
                            style="
                                padding-top: 0;
                                padding-bottom: 0;
                                height: 50%;
                            "
                        >
                            {{ project.description }}
                        </q-card-section>
                        <q-card-section style="max-height: 30%">
                            Updated {{ timeAgo(project) }}
                        </q-card-section>
                    </q-card>
                </div>

                <q-separator vertical />
            </template>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { Project } from 'src/types/Project';
import { filteredProjects, recentProjects } from 'src/services/queries/project';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'vue-router';

const router = useRouter();

const { data } = useQuery<Project[]>({
    queryKey: ['projects', 5],
    queryFn: () => recentProjects(5),
});

const projects = computed(() => (data.value ? data.value : []));

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
const canScrollRight = ref(true);
const canScrollLeft = ref(false);

function checkScroll() {
    if (cardWrapper.value) {
        canScrollRight.value =
            cardWrapper.value.scrollWidth - cardWrapper.value.scrollLeft >
            cardWrapper.value.clientWidth;
        canScrollLeft.value = cardWrapper.value.scrollLeft > 0;
    }
}

checkScroll();

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
    grid-column: span 2;
    background-color: white;
    display: grid;
    grid-template-rows: 50px 2px auto;
}

.header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.arrow-buttons {
    display: flex;
    gap: 8px;
}

.card-wrapper {
    display: flex;
    overflow-x: auto; /* Enable horizontal scrolling */
    margin-top: 0;
    padding-top: 0;
    scrollbar-width: none;
}

.card {
    min-width: 300px; /* Prevent card from shrinking */
    cursor: pointer;
}

.q-card {
    border-radius: 0;
}

.card .q-card:hover {
    background-color: #e0e0e0;
}

.scroll-button {
    z-index: 1;
}
</style>
