<template>
    <q-btn-dropdown
        dense
        flat
        class="button-border q-px-sm my-projects-selector"
        aria-label="Filter the project list by owner"
    >
        <template #label>
            {{ myProjects ? 'My Projects' : 'All Projects' }}
        </template>
        <q-list>
            <q-item
                v-for="(item, index) in ['All Projects', 'My Projects']"
                :key="index"
                v-close-popup
                clickable
                @click="() => (myProjects = item === 'My Projects')"
            >
                <q-item-section>
                    {{ item }}
                </q-item-section>
            </q-item>
        </q-list>
    </q-btn-dropdown>
</template>
<script setup lang="ts">
const myProjects = defineModel<boolean>();
</script>

<style scoped>
/* Comfortable touch target on phones and tablets */
@media (max-width: 1023px) {
    .my-projects-selector {
        min-height: 40px;
    }
}
</style>
