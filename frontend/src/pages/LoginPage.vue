<template>

    <q-btn @click="login()"> Login with Google</q-btn>

</template>

<script setup lang="ts">
import { login } from 'src/services/auth';
</script>