// @ts-ignore
import { defineRouter } from '#q-app/wrappers';
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import routes from './routes';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export default defineRouter(() => {
    const routeArray: RouteRecordRaw[] = Object.values(routes).filter(
        (r) => 'path' in r,
    );

    return createRouter({
        scrollBehavior: () => ({ left: 0, top: 0 }),
        routes: routeArray,

        // Leave this as is and make changes in quasar.conf.js instead!
        // quasar.conf.js -> build -> vueRouterMode
        // quasar.conf.js -> build -> publicPath
        history: createWebHistory('/'),
    });
});
