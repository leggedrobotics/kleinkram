import { route } from 'quasar/wrappers';
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import routes from './routes';

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default route(() => {
    const routeArray: RouteRecordRaw[] = Object.values(routes);

    return createRouter({
        scrollBehavior: () => ({ left: 0, top: 0 }),
        routes: routeArray,

        // Leave this as is and make changes in quasar.conf.js instead!
        // quasar.conf.js -> build -> vueRouterMode
        // quasar.conf.js -> build -> publicPath
        history: createWebHistory('/'),
    });
});
