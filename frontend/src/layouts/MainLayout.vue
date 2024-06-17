<template>
    <q-layout view="lHh lpr lFf" style="position: absolute">
        <HeaderComponent />

        <q-page-container>

            <q-banner inline-actions class="text-white bg-red">
                <template v-slot:avatar>
                    <q-icon name="warning" color="white" />
                </template>
                This app is in active development. Data will be reset without notice!
            </q-banner>

            <router-view />

        </q-page-container>

        <FooterComponent />
    </q-layout>
</template>

<script setup lang="ts">
import FooterComponent from 'components/FooterComponent.vue';
import HeaderComponent from 'components/HeaderComponent.vue';
</script>