<template>
    <div class="flex row justify-center cursor-pointer q-my-auto q-pa-none">
        <img src="/logoRSL.png" style="height: 28px" alt="RSL Logo">
        <div
            v-show="$q.screen.gt.sm"
            class="flex column justify-center"
            style="margin-left: 12px"
        >
            <span
                style="
                    margin-right: 30px;
                    font-weight: 600;
                    font-size: 16px;
                    line-height: 18px;
                "
            >
                Kleinkram
            </span>
            <span style="font-size: 10px; line-height: 12px">by Robotic Systems Lab</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';

const $q = useQuasar();
</script>
