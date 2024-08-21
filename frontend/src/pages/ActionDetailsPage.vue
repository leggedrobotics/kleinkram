<template>
    <title-section title="Action Details">
        <template #tabs>
            <q-tabs
                v-model="tab"
                dense
                class="text-grey"
                align="left"
                active-color="primary"
            >
                <q-tab name="info" label="Details" style="color: #222" />
                <q-tab name="logs" label="Logs" style="color: #222" />
            </q-tabs>
        </template>
    </title-section>

    <q-tab-panels v-model="tab" class="q-mt-lg">
        <q-tab-panel name="info">
            <q-card
                class="q-pa-lg"
                style="background-color: #f4f4f4"
                flat
                bordered
            >
                <q-card-section class="flex column q-pa-none">
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
                        <span style="font-weight: bold" class="q-pr-sm">
                            Status:
                        </span>
                        <span>{{ data?.state }}</span>
                    </div>

                    <div
                        class="flex justify-start"
                        v-if="data?.state_cause != ''"
                    >
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
                        <span style="font-weight: bold" class="q-pr-sm">
                            Runtime
                        </span>
                        <span>{{ data?.getRuntimeInMS() / 1000 }} seconds</span>
                    </div>
                </q-card-section>
            </q-card>
        </q-tab-panel>

        <q-tab-panel name="logs">
            <q-card
                class="q-pa-lg"
                style="background-color: #f4f4f4"
                flat
                bordered
            >
                <q-card-section class="flex column q-pa-none">
                    <div
                        v-for="log in data?.logs"
                        :key="log.timestamp"
                        class="flex justify-start q-pb-xs"
                        style="
                            font-family: monospace;
                            color: #222222;
                            font-size: 0.8em;
                        "
                    >
                        <template v-if="log.type == 'stdout'">
                            <span
                                class="q-pr-sm"
                                style="user-select: none; color: #525252"
                                >{{ log.timestamp }}</span
                            >
                            <span
                                class="q-pr-sm"
                                style="user-select: none; color: #525252"
                            >
                                [{{ log.type }}]
                            </span>

                            <span
                                style="margin-left: -250px; padding-left: 250px"
                            >
                                {{ log.message.replaceAll(' ', '\u00a0') }}
                            </span>
                        </template>

                        <template v-else>
                            <span
                                class="q-pr-sm"
                                style="user-select: none; color: #fd7c7cff"
                                >{{ log.timestamp }}</span
                            >
                            <span
                                class="q-pr-sm"
                                style="user-select: none; color: #fd7c7cff"
                            >
                                [{{ log.type }}]
                            </span>

                            <span
                                style="
                                    margin-left: -250px;
                                    padding-left: 250px;
                                    color: #ff3c3c;
                                "
                            >
                                {{ log.message.replaceAll(' ', '\u00a0') }}
                            </span>
                        </template>
                    </div>
                </q-card-section>
            </q-card>
        </q-tab-panel>
    </q-tab-panels>
</template>

<script setup lang="ts">
import 'vue-json-pretty/lib/styles.css';

// print the id of the action mission (extracted from the route)
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { actionDetails } from 'src/services/queries/action';
import { Action } from 'src/types/Action';
import TitleSection from 'components/TitleSection.vue';
import { ref } from 'vue';

const tab = ref('info');

const $route = useRoute();

const { data } = useQuery<Action>({
    queryKey: ['missions_action', $route.params.id],
    queryFn: () => actionDetails($route.params.id as string),
});
</script>
