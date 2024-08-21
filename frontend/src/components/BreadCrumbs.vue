<template>
    <div
        class="bg-default text-grey-8"
        style="margin: 0 -24px; position: sticky; top: 64px; z-index: 999"
    >
        <div class="height-xl flex column justify-center q-px-lg">
            <q-breadcrumbs gutter="md">
                <template v-for="crumb in crumbs" :key="crumb.name">
                    <q-breadcrumbs-el
                        v-if="isClickable(crumb)"
                        class="text-link-primary"
                        :to="crumb.to"
                        :label="crumb.displayName"
                    />

                    <q-breadcrumbs-el v-else :label="crumb.displayName" />
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
        <q-separator v-if="crumbs?.length >= 1" />
    </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useCrumbs } from 'src/hooks/crumbs';
import { PageBreadCrumb } from 'src/router/routesUtils';

const isLoading = ref(false);
const crumbs = useCrumbs();

const isClickable = (crumb: PageBreadCrumb) => {
    const idx = crumbs.value?.findIndex(
        (c: PageBreadCrumb) => c.displayName === crumb.displayName,
    );
    return idx !== crumbs.value.length - 1 && !!crumb.to;
};
</script>
