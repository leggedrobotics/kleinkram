<template>
  <div>
    <h1>Login Successfull</h1>
  </div>
</template>
<script setup lang="ts">
import {inject, ref} from 'vue';
import RouterService from 'src/services/routerService';
import ROUTES from 'src/router/routes';
import {isLoggedIn, loggedIn} from 'src/services/auth';
const $routerService: RouterService | undefined = inject('$routerService');
$routerService?.routeTo(ROUTES.HOME);
loggedIn.value = isLoggedIn();

</script>
<style scoped>

</style>
