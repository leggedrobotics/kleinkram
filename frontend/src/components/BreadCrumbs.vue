<template>
    <div
        class="bg-default text-grey-8"
        style="
            margin: 0 -24px;
            border-bottom: 1px solid #e0e0e0;
            position: sticky;
            top: 64px;
        "
    >
        <div class="height-xl flex column justify-center q-px-lg">
            <q-breadcrumbs gutter="md">
                <template v-for="crumb in crumbs" :key="crumb.name">
                    <q-breadcrumbs-el
                        v-if="!isLastCrumb(crumb)"
                        class="text-link-primary"
                        :to="crumb.link"
                        :label="crumb.name"
                    />

                    <q-breadcrumbs-el v-else :label="crumb.name" />
                </template>

                <template v-if="isLoading">
                    <q-breadcrumbs-el>
                        <q-skeleton
                            class="q-mr-md q-mb-sm"
                            style="width: 200px; height: 18px; margin-top: 5px"
                        />
                    </q-breadcrumbs-el>
                </template>
            </q-breadcrumbs>
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

const isLoading = ref(false);

const route = useRoute();

type Crumbs = {
    name: string;
    link: string | undefined;
}[];

const crumbs = computed<Crumbs>(() => [
    {
        name: 'All Projects',
        link: '/projects',
    },
]);

const isLastCrumb = (crumb: any) => {
    const idx = crumbs.value.findIndex((c: any) => c.name === crumb.name);
    return idx === crumbs.value.length - 1;
};
</script>
