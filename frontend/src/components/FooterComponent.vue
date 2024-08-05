<template>
  <q-footer
    bordered
    class="bg-white text-grey-8"
  >
    <q-toolbar>
      <q-toolbar class="flex flex-center text-center q-pa-md">
        Robotics Systems Lab (RSL), ETH Zurich
        <br>
        Build: {{ BUILD_INFO.version }} ({{
          new Date(BUILD_INFO.timestamp).toLocaleString()
        }}) - {{ BUILD_INFO.git.branch }} -
        {{ BUILD_INFO.git.hash }}
      </q-toolbar>
    </q-toolbar>
  </q-footer>
</template>

<script setup lang="ts">
import BUILD_INFO from 'src/build';
</script>
