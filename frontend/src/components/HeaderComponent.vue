<template>
  <q-header bordered class="bg-white text-grey-9">
    <q-toolbar>
      <q-btn flat dense round icon="menu" v-show="$q.screen.lt.md">
        <q-menu auto-close style="width: 280px">
          <q-list>
            <q-item
                v-for="item in main_menu"
                :key="item.title"
                clickable
                :to="item.to"
            >
              <q-item-section avatar>
                <q-icon :name="item.icon"/>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ item.title }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

        <q-toolbar-title shrink style="margin-right: 30px" class="cursor-pointer" @click="$router.push('/')">
          Kleinkram
        </q-toolbar-title>

      <q-tabs v-show="$q.screen.gt.sm" inline-label>
        <q-route-tab
            v-for="item in main_menu"
            :key="item.title"
            :label="item.title"
            :to="item.to"
            :icon="item.icon"
        />
      </q-tabs>

      <q-space/>
      <Suspense>
        <ProfileComponent/>
      </Suspense>
    </q-toolbar>
  </q-header>
</template>

<script setup lang="ts">
import ROUTES from 'src/router/routes';
import ProfileComponent from 'components/ProfileComponent.vue';

const main_menu = [
  {title: 'Home', icon: 'home', to: ROUTES.HOME.path},
  {title: 'Datatable', icon: 'table_chart', to: ROUTES.DATATABLE.path},
  {title: 'Explorer', icon: 'explore', to: ROUTES.EXPLORER.path},
  {title: 'Upload', icon: 'cloud_upload', to: ROUTES.UPLOAD.path},
  {title: 'Analysis', icon: 'analytics', to: ROUTES.ACTION.path},
  {title: 'Access Rights', icon: 'lock', to: ROUTES.ACCESSRIGHTS.path},
];
</script>
