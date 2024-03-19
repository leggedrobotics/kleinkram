<template>
  <router-view />
</template>

<script setup lang="ts">
// Router service ('as unknown' is needed, since linter doesn't seem to understand router instance as parameter)
import RouterService from 'src/services/routerService';
import { provide, reactive } from 'vue';
import { routerInstance } from 'boot/router';


const $routerService: RouterService = reactive(
  new RouterService(routerInstance)
) as unknown as RouterService;
provide<RouterService>(
  '$routerService',
  $routerService as unknown as RouterService
);
</script>
