<template>
    <q-footer class="text-grey-8" style="position: absolute">
        <q-toolbar>
            <q-toolbar
                class="flex text-center justify-between"
                style="font-size: 12px"
            >
                <span>
                    © {{ year }} ETH Zürich - Robotics Systems Lab (RSL)
                </span>
                <span>
                    Build: {{ BUILD_INFO.version }} ({{
                        new Date(BUILD_INFO.timestamp).toLocaleString()
                    }}) - {{ BUILD_INFO.git.branch }} -
                    {{ BUILD_INFO.git.hash }}
                </span>
            </q-toolbar>
        </q-toolbar>
    </q-footer>
</template>

<script setup lang="ts">
import BUILD_INFO from 'src/build';

const year = new Date().getFullYear();
</script>
