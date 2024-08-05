<template>
  <q-layout
    view="lHh lpr lFf"
    style="position: absolute"
  >
    <q-page-container>
      <router-view />
    </q-page-container>
    <FooterComponent />
  </q-layout>
</template>

<script setup lang="ts">
import FooterComponent from 'components/FooterComponent.vue';
import HeaderComponent from 'components/HeaderComponent.vue';
</script>