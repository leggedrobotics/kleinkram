<template>
    <q-page class="flex flex-center bg-grey-2 q-py-md">
        <q-card class="q-pa-md shadow-2 my_card" bordered>
            <q-card-section class="text-center">
                <div
                    class="text-grey-9 text-weight-bold"
                    :class="$q.screen.xs ? 'text-h4' : 'text-h2'"
                >
                    404 Error
                </div>
                <div
                    class="text-grey-8"
                    :class="$q.screen.xs ? 'text-subtitle1' : 'text-h5'"
                >
                    The page you are looking <br />for does not exist.
                </div>
            </q-card-section>

            <q-card-section class="text-center q-pt-none">
                <div class="text-grey-8">
                    Do you want to go back?
                    <a
                        href="/"
                        class="text-dark text-weight-bold back-link"
                        style="text-decoration: none"
                        >Back to Home.</a
                    >
                </div>
            </q-card-section>
        </q-card>
    </q-page>
</template>

<script setup lang="ts"></script>

<style scoped>
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
