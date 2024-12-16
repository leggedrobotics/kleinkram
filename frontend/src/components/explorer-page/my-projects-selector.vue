<template>
    <q-btn-dropdown dense flat class="button-border q-px-sm">
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
