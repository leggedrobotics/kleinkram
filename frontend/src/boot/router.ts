import { boot } from 'quasar/wrappers';
import { Router } from 'vue-router';
import { isAuthenticated } from 'src/services/auth';
import ROUTES, { PUBLIC_ROUTES } from 'src/router/routes';

let routerInstance: Router;


export default boot(({ router }) => {
    routerInstance = router;

    routerInstance.beforeEach(async (to, from) => {
        console.log('router.beforeEach', to, from);

        // check if it's a public route
        if (PUBLIC_ROUTES.some((route) => route.path === to.path)) {
            return;
        }

        // check if the user is authenticated, if not redirect to login
        const authenticated = await isAuthenticated();
        if (!authenticated && to.path !== ROUTES.LOGIN.path) {
            return ROUTES.LOGIN.path;
        }

    });
});

export { routerInstance };
