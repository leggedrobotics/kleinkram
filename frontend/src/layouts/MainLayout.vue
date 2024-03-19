<template>
  <q-layout view="lHh Lpr lFf">
    <q-header
      class="bg-white text-grey-8 q-py-xs"
      height-hint="58"
      bordered
      style="padding-top: unset"
    >
      <div class="row">
        <div class="col-8" style="padding-left: 10%">
          <h1
            v-if="$q.screen.gt.xs"
            class="text-weight-bold"
            style="margin: 0"
          >
            Grand Tour
          </h1>
          <h1 v-else class="text-weight-bold" style="font-size: 60px">
            Grand Tour
          </h1>
          <h4 v-if="$q.screen.gt.xs" style="margin: 0">
            Datasets
          </h4>
        </div>
        <div class="col-4" >
          <div style="max-height: 140px; height: 100%">
            <q-img
              src="/rsl.png"
              fit="contain"
              style="max-height: 100%"
            />
          </div>

        </div>
      </div>
      <div class="row">
        <q-toolbar>
          <q-btn
            flat
            no-caps
            no-wrap
            icon="home"
            @click="goHome"
          >
            Home
          </q-btn>
          <q-btn
            flat
            no-caps
            no-wrap
            class="q-ml-xs"
            icon="table_chart"
            @click="goDatatable"
          >
            Dataviewer
          </q-btn>
          <q-btn
            flat
            no-caps
            no-wrap
            class="q-ml-xs"
            icon="cloud_upload"
            @click="goUpload"
          >
            Upload data
          </q-btn>
          <q-btn
            flat
            no-caps
            no-wrap
            class="q-ml-xs"
            icon="analytics"
          >
            Run analysis
          </q-btn>
        </q-toolbar>
      </div>
    </q-header>
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import ROUTES from 'src/router/routes';
import { inject } from 'vue';
import RouterService from 'src/services/routerService';
const $routerService: RouterService | undefined = inject('$routerService');
function goHome(): void {
  console.log('goHome');
  console.log($routerService);
  void $routerService?.routeTo(ROUTES.HOME);
}
function goDatatable(): void {
  console.log('goDatatable');
  void $routerService?.routeTo(ROUTES.DATATABLE);
}

function goUpload(): void {
  console.log('goUpload');
  void $routerService?.routeTo(ROUTES.UPLOAD);
}
</script>
