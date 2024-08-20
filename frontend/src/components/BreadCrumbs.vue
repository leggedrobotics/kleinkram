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
    </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { PageBreadCrumb } from 'src/router/routes';
import { useCrumbs } from 'src/hooks/crumbs';

const isLoading = ref(false);
const crumbs = useCrumbs();

const isClickable = (crumb: PageBreadCrumb) => {
    const idx = crumbs.value?.findIndex(
        (c: PageBreadCrumb) => c.displayName === crumb.displayName,
    );
    return idx !== crumbs.value.length - 1 && !!crumb.to;
};
</script>
