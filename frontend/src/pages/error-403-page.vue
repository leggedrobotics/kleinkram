<template>
    <q-page class="flex flex-center bg-grey-2">
        <q-card class="q-pa-md shadow-2 my_card" bordered>
            <q-card-section class="text-center">
                <div class="text-grey-9 text-h2 text-weight-bold">
                    403 Error
                </div>
                <div v-if="message" class="text-grey-8 text-h5">
                    {{ message }}
                </div>
                <div v-else class="text-grey-8 text-h5">
                    You are not authorized to access this page.
                </div>

                <div v-if="projectUuid" class="text-grey-8 text-h6 q-mt-lg">
                    Project UUID:<br />
                    {{ projectUuid }}
                </div>
            </q-card-section>

            <q-card-section class="text-center q-pt-none">
                <div class="text-grey-8">
                    Do you want to go back?
                    <a
                        href="/dashboard"
                        class="text-dark text-weight-bold"
                        style="text-decoration: none"
                    >
                        Back to Dashboard.
                    </a>
                </div>
            </q-card-section>
        </q-card>
    </q-page>
</template>

<script setup lang="ts">
const urlParameters = new URLSearchParams(globalThis.location.search);
const message = urlParameters.get('message');
const projectUuid = urlParameters.get('projectUuid');
</script>
