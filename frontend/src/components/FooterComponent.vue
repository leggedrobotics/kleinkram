<template>
    <div class="text-placeholder">
        <q-toolbar>
            <q-toolbar
                class="flex text-center justify-between"
                style="font-size: 12px"
            >
                <div class="flex" style="gap: 8px">
                    <span>
                        © {{ year }} ETH Zürich - Robotics Systems Lab (RSL)
                    </span>
                    <span> • </span>
                    <q-icon
                        v-if="
                            !!kleinkramVersion &&
                            kleinkramVersion !== BUILD_INFO.version
                        "
                        name="sym_o_warning"
                        color="red"
                    >
                        <q-tooltip
                            >The API is running
                            {{ kleinkramVersion }}</q-tooltip
                        >
                    </q-icon>
                    <a
                        class="text-placeholder"
                        style="text-decoration: none"
                        :href="
                            'https://github.com/leggedrobotics/kleinkram/releases/tag/v' +
                            BUILD_INFO.version
                        "
                        >{{ BUILD_INFO.version }} ({{
                            new Date(BUILD_INFO.timestamp).toLocaleString()
                        }})</a
                    >
                    <span> • </span>

                    <a
                        class="text-placeholder"
                        style="text-decoration: none"
                        :href="
                            'https://github.com/leggedrobotics/kleinkram/tree/' +
                            BUILD_INFO.git.branch
                        "
                    >
                        {{ BUILD_INFO.git.branch }}
                    </a>

                    <span> • </span>

                    <a
                        class="text-placeholder"
                        style="text-decoration: none"
                        :href="
                            'https://github.com/leggedrobotics/kleinkram/commit/' +
                            BUILD_INFO.git.hash
                        "
                    >
                        {{ BUILD_INFO.git.hash }}
                    </a>
                </div>
                <span>
                    <a
                        class="text-placeholder"
                        style="text-decoration: none"
                        href="https://uptime.leggedrobotics.com/status/kleinkram"
                    >
                        Statuspage</a
                    >
                </span>
            </q-toolbar>
        </q-toolbar>
    </div>
</template>

<script setup lang="ts">
import BUILD_INFO from 'src/build';
import { kleinkramVersion } from 'src/api/axios';

const year = new Date().getFullYear();
</script>
