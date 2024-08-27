<template>
    <div>
        <h1>Login Successfull</h1>
    </div>
</template>
<script setup lang="ts">
import ROUTES from 'src/router/routes';
import { useRouter } from 'vue-router';

const $router = useRouter();

$router.push({ name: ROUTES.DASHBOARD.routeName });
</script>
<style scoped></style>
