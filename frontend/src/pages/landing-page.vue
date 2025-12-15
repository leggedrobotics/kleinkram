<template>
    <div class="fixed-center text-center">
        <q-spinner color="primary" size="3em" />
        <div class="q-mt-md text-h6">Login Successful</div>
        <div class="text-subtitle2 text-grey">Redirecting...</div>
    </div>
</template>
<script setup lang="ts">
import ROUTES from 'src/router/routes';
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const $router = useRouter();

// The router should catch any routing to this page and redirect to the original target. See frontend/src/boot/router.ts
onMounted(async () => {
    await $router.push({ name: ROUTES.DASHBOARD.routeName });
});
</script>
<style scoped></style>
