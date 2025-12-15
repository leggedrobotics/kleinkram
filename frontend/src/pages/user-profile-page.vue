<template>
    <div>
        <Suspense>
            <UserProfileDetails />
        </Suspense>
    </div>
</template>

<script setup lang="ts">
import UserProfileDetails from 'components/user-profile/user-profile.vue';
</script>
