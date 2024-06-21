<template>
    <div class="q-pa-md">
        <h1 class="text-h4">User Profile</h1>
        <Suspense>
            <vue-json-pretty :data="data" />
        </Suspense>
    </div>
</template>

<script setup lang="ts">
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';
import { getUser } from 'src/services/auth';

const data = await getUser();

</script>
