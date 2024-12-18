<template>
    <q-layout
        view="lHh lpr lFf"
        style="position: absolute"
        class="transparent-on-open-dialog"
    >
        <HeaderComponent />

        <main>
            <q-page-container
                style="
                    width: auto;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                "
            >
                <div>
                    <development-instance-warning />
                    <router-view />
                </div>
                <FooterComponent />
            </q-page-container>
        </main>
    </q-layout>
</template>

<script setup lang="ts">
import HeaderComponent from './header/header-component.vue';
import FooterComponent from './footer/footer-component.vue';
import DevelopmentInstanceWarning from '@components/banner/dev-instance-warning-banner.vue';
</script>
