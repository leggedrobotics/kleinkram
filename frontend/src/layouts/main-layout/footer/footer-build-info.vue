<template>
    <q-icon
        v-if="!!kleinkramVersion && kleinkramVersion !== BUILD_INFO.version"
        name="sym_o_warning"
        color="red"
    >
        <q-tooltip>
            The API is running
            {{ kleinkramVersion }}
        </q-tooltip>
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
        }})</a>
    <footer-separator />
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
    <footer-separator />
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
</template>

<script setup lang="ts">
// @ts-ignore (build.ts is only available at runtime)
import BUILD_INFO from 'src/build';
import { kleinkramVersion } from '../../../api/axios';
import FooterSeparator from './footer-separator.vue';
</script>
