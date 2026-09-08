<template>
    <q-page class="flex flex-center bg-grey-2 q-py-md">
        <q-card class="q-pa-md shadow-2 my_card" bordered>
            <q-card-section class="text-center">
                <div
                    class="text-grey-9 text-weight-bold"
                    :class="$q.screen.xs ? 'text-h4' : 'text-h2'"
                >
                    403 Error
                </div>
                <div
                    v-if="message"
                    class="text-grey-8"
                    :class="$q.screen.xs ? 'text-subtitle1' : 'text-h5'"
                >
                    {{ message }}
                </div>
                <div
                    v-else
                    class="text-grey-8"
                    :class="$q.screen.xs ? 'text-subtitle1' : 'text-h5'"
                >
                    You are not authorized to access this page.
                </div>

                <div
                    v-if="projectUuid"
                    class="text-grey-8 q-mt-lg project-uuid"
                    :class="$q.screen.xs ? 'text-subtitle2' : 'text-h6'"
                >
                    Project UUID:<br />
                    {{ projectUuid }}
                </div>
            </q-card-section>

            <q-card-section class="text-center q-pt-none">
                <div class="text-grey-8">
                    Do you want to go back?
                    <a
                        href="/dashboard"
                        class="text-dark text-weight-bold back-link"
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

<style scoped>
/* A UUID is a single long token; let it wrap instead of widening the card */
.project-uuid {
    overflow-wrap: anywhere;
}

@media (max-width: 599px) {
    .my_card {
        width: 100%;
    }

    /* Comfortable touch target for the only link on the page */
    .back-link {
        display: inline-block;
        min-height: 40px;
        line-height: 40px;
    }
}
</style>
