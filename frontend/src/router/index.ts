import { defineRouter } from '#q-app';
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import routes from './routes';

export default defineRouter(() => {
    const routeArray: RouteRecordRaw[] = Object.values(routes).filter(
        (r) => 'path' in r,
    );

    return createRouter({
        // vue-router 5.5 deprecates this in favour of the experimental
        // `ScrollRestoration` API; keep the stable option until that ships.
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        scrollBehavior: () => ({ left: 0, top: 0 }),
        routes: routeArray,

        // Leave this as is and make changes in quasar.conf.js instead!
        // quasar.conf.js -> build -> vueRouterMode
        // quasar.conf.js -> build -> publicPath
        history: createWebHistory('/'),
    });
});
