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
                    <dev-instance-warning />
                    <router-view />
                </div>
                <FooterComponent />
            </q-page-container>
        </main>
    </q-layout>
</template>

<script setup lang="ts">
import FooterComponent from 'components/footer/FooterComponent.vue';
import DevInstanceWarning from 'components/DevInstanceWarning.vue';
import HeaderComponent from '../components/header/HeaderComponent.vue';
</script>
