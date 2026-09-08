<template>
    <div class="flex flex-center">
        <div :class="$q.screen.xs ? 'q-pa-md' : 'q-pa-lg'" class="index-hero">
            <div
                class="text-center"
                :class="$q.screen.xs ? 'text-h4' : 'text-h3'"
            >
                Kleinkram
            </div>
            <div
                class="text-center"
                :class="$q.screen.xs ? 'text-subtitle1' : 'text-h5'"
            >
                A web-based tool for managing ROS bags
            </div>
            <q-img src="/rsl.png" class="q-mt-md" />
        </div>
    </div>
</template>

<script setup lang="ts"></script>
<style scoped>
.index-hero {
    max-width: 100%;
}
</style>
