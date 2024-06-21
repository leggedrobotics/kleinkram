<template>
    <q-page class="flex">
            <Suspense>
                <UserProfileDetails />
            </Suspense>
    </q-page>
</template>

<script setup lang="ts">
import UserProfileDetails from 'components/UserProfileDetails.vue';
</script>