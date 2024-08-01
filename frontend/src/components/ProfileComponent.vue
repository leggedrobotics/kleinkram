<script setup lang="ts">
import {getUser, isAuthenticated, logout} from 'src/services/auth';
import ROUTES from 'src/router/routes';
import {useRouter} from 'vue-router';

const is_authenticated = await isAuthenticated();
const user = await getUser();

const $router = useRouter();
const navigateTo = (path: string) => {
  $router.push(path);
};

</script>

<template>

  <q-tabs>
    <q-route-tab :to="ROUTES.LOGIN.path" v-if="!is_authenticated"> Sign in</q-route-tab>

    <div class="q-gutter-sm row items-center no-wrap" v-else>

      <q-btn href="https://docs.datasets.leggedrobotics.com/usage/getting-started.html" round flat target="_blank">
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#5f6368">
          <path
              d="M478-240q21 0 35.5-14.5T528-290q0-21-14.5-35.5T478-340q-21 0-35.5 14.5T428-290q0 21 14.5 35.5T478-240Zm-36-154h74q0-33 7.5-52t42.5-52q26-26 41-49.5t15-56.5q0-56-41-86t-97-30q-57 0-92.5 30T342-618l66 26q5-18 22.5-39t53.5-21q32 0 48 17.5t16 38.5q0 20-12 37.5T506-526q-44 39-54 59t-10 73Zm38 314q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
        </svg>
      </q-btn>

      <q-btn round flat>
        <q-avatar size="32px" v-if="!!user['avatarUrl'] && user['avatarUrl'] !== ''">
          <img :src="user['avatarUrl']" referrerpolicy="no-referrer" alt="avatar">
        </q-avatar>

        <q-avatar size="36px" v-else>
          <q-icon name="account_circle"/>
        </q-avatar>

        <q-menu auto-close style="width: 280px">
          <q-list>
            <q-item clickable v-close-popup @click="navigateTo(ROUTES.USER_PROFILE.path)">
              <q-item-section avatar></q-item-section>
              <q-item-section>
                <q-item-section>{{ user['name'] }}</q-item-section>
              </q-item-section>
            </q-item>
            <q-item clickable @click="logout">
              <q-item-section avatar>
                <q-icon name="logout"/>
              </q-item-section>
              <q-item-section>
                <q-item-label>Sign out</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>

      </q-btn>
    </div>

  </q-tabs>

</template>


