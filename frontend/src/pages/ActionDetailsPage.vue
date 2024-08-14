<template>
    <q-card class="q-pa-md q-mb-md q-mt-xl" flat bordered>
        <q-card-section class="flex column">
            <h2 class="text-h6">Action Details</h2>

            <div class="flex justify-start">
                <span style="font-weight: bold" class="q-pr-sm">
                    Docker Image:
                </span>
                <span
                    >{{ data?.docker_image }}

                    <template v-if="data?.docker_image_sha !== ''">
                        ({{ data?.docker_image_sha }})
                    </template>
                </span>
            </div>

            <div class="flex justify-start">
                <span style="font-weight: bold" class="q-pr-sm">
                    Created By:
                </span>
                <span>{{ data?.createdBy.name }}</span>
            </div>

            <div class="flex justify-start">
                <span style="font-weight: bold" class="q-pr-sm"> Status: </span>
                <span>{{ data?.state }}</span>
            </div>

            <div class="flex justify-start" v-if="data?.state_cause != ''">
                <span style="font-weight: bold" class="q-pr-sm">
                    Status Reason:
                </span>
                <span>{{ data?.state_cause }}</span>
            </div>

            <div class="flex justify-start">
                <span style="font-weight: bold" class="q-pr-sm">
                    Submitted At:
                </span>
                <span>{{ data?.createdAt }}</span>
            </div>

            <div class="flex justify-start">
                <span style="font-weight: bold" class="q-pr-sm">
                    Last Updated At:
                </span>
                <span>{{ data?.updatedAt }}</span>
            </div>

            <div class="flex justify-start">
                <span style="font-weight: bold" class="q-pr-sm">
                    Runner CPU Model:
                </span>
                <span>{{ data?.runner_cpu_model }}</span>
            </div>

            <div class="flex justify-start">
                <span style="font-weight: bold" class="q-pr-sm">
                    Runner Hostname:
                </span>
                <span>{{ data?.runner_hostname }}</span>
            </div>

            <div
                class="flex justify-start"
                v-if="data && data?.getRuntimeInMS() != 0"
            >
                <span style="font-weight: bold" class="q-pr-sm"> Runtime </span>
                <span>{{ data?.getRuntimeInMS() / 1000 }} seconds</span>
            </div>
        </q-card-section>
    </q-card>

    <q-card class="q-pa-md q-mb-md q-mb-xl" flat bordered>
        <q-card-section class="flex column">
            <h2 class="text-h6">Action Logs</h2>

            <div
                v-for="log in data?.logs"
                :key="log.timestamp"
                class="flex justify-start q-pb-xs"
                style="font-family: monospace; color: #222222; font-size: 0.8em"
            >
                <span class="q-pr-sm">{{ log.timestamp }}</span>
                <span class="q-pr-sm"> [{{ log.type }}] </span>
                <span>{{ log.message.replaceAll(' ', '\u00a0') }}</span>
            </div>
        </q-card-section>
    </q-card>
</template>

<script setup lang="ts">
import 'vue-json-pretty/lib/styles.css';

// print the id of the action mission (extracted from the route)
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { actionDetails } from 'src/services/queries/action';
import { Action } from 'src/types/Action';

const $route = useRoute();

const { data } = useQuery<Action>({
    queryKey: ['missions_action', $route.params.id],
    queryFn: () => actionDetails($route.params.id as string),
});
</script>
