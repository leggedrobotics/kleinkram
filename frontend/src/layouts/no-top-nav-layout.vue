<template>
    <q-layout view="lHh lpr lFf" style="position: absolute">
        <q-page-container>
            <router-view />
        </q-page-container>
        <FooterComponent />
    </q-layout>
</template>

<script setup lang="ts">
import FooterComponent from './main-layout/footer/footer-component.vue';
</script>
