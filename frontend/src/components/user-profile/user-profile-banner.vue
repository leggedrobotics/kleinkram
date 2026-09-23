<template>
    <div
        v-if="user"
        class="profile-banner"
        :class="$q.screen.xs ? 'column items-center text-center' : 'row'"
    >
        <q-img
            v-if="user.avatarUrl"
            :src="user.avatarUrl"
            class="profile-banner__avatar"
        />
        <div :class="$q.screen.xs ? 'q-mt-sm' : 'q-ml-md'">
            <h2
                class="profile-banner__name"
                :class="$q.screen.xs ? 'text-h5' : 'text-h3'"
            >
                {{ user.name }}
            </h2>
            <p class="text-subtitle2 profile-banner__email">
                {{ user.email }}
            </p>
        </div>
    </div>
    <div v-else>
        <q-spinner-gears size="100px" />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { useUser } from 'src/hooks/query-hooks';
import 'vue-json-pretty/lib/styles.css';

const $q = useQuasar();
const { data: user } = useUser();
</script>

<style scoped>
.profile-banner {
    max-width: 100%;
}

.profile-banner__avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    flex: 0 0 auto;
}

.profile-banner__name {
    margin-bottom: 5px;
    margin-top: 10px;
    overflow-wrap: anywhere;
}

.profile-banner__email {
    color: #58585c;
    overflow-wrap: anywhere;
}

@media (max-width: 599px) {
    .profile-banner__avatar {
        width: 72px;
        height: 72px;
    }

    .profile-banner__name {
        margin-top: 0;
    }
}
</style>
