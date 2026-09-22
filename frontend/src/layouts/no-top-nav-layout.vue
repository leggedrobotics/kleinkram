<template>
    <q-layout view="lHh lpr lFf" style="position: absolute">
        <!--
            The footer lives inside the page container (as in the main layout):
            it bleeds to the viewport edges with negative gutter margins, which
            only cancel out against the container's gutter margins.
        -->
        <q-page-container
            style="
                width: auto;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            "
        >
            <router-view />
            <FooterComponent />
        </q-page-container>
    </q-layout>
</template>

<script setup lang="ts">
import FooterComponent from './main-layout/footer/footer-component.vue';
</script>
