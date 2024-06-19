<script setup lang="ts">
import {getUser, isAuthenticated, logout} from 'src/services/auth';
import ROUTES from "src/router/routes";

const is_authenticated = await isAuthenticated();
const user = await getUser();
</script>

<template>

  <q-tabs>
    <q-route-tab :to="ROUTES.LOGIN.path" v-if="!is_authenticated"> Sign in</q-route-tab>

    <div class="q-gutter-sm row items-center no-wrap" v-else>
      <q-btn round flat>
        <q-avatar size="32px" v-if="!!user['avatarUrl'] && user['avatarUrl'] !== ''">
          <img :src="user['avatarUrl']" referrerpolicy="no-referrer" alt="avatar">
        </q-avatar>

        <q-avatar size="36px" v-else>
          <q-icon name="account_circle"/>
        </q-avatar>

        <q-menu>
          <q-list dense style="min-width: 150px; text-align: right">
            <q-item clickable v-close-popup>
              <q-item-section>{{ user['name'] }}</q-item-section>
            </q-item>
            <q-separator/>
            <q-item clickable>
              <q-item-section>
                <q-icon name="logout"/>
              </q-item-section>
              <q-item-section @click="logout">Sign out</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

  </q-tabs>

</template>


