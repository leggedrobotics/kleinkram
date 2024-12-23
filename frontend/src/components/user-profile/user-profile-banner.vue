<template>
    <div v-if="user" class="row">
        <q-img
            v-if="user.avatarUrl"
            :src="user.avatarUrl"
            style="width: 100px; height: 100px; border-radius: 50%"
        />
        <div class="q-ml-md">
            <h2 class="text-h3" style="margin-bottom: 5px; margin-top: 10px">
                {{ user.name }}
            </h2>
            <p class="text-subtitle2" style="color: #58585c">
                {{ user.email }}
            </p>
        </div>
    </div>
    <div v-else>
        <q-spinner-gears size="100px" />
    </div>
</template>

<script setup lang="ts">
import 'vue-json-pretty/lib/styles.css';
import { useUser } from '../../hooks/query-hooks';

const { data: user } = useUser();
</script>
