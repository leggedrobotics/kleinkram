import { boot } from 'quasar/wrappers';
import { Router } from 'vue-router';
import { isAuthenticated } from 'src/services/auth';
import ROUTES, { PUBLIC_ROUTES } from 'src/router/routes';

let routerInstance: Router;
export default boot(({ router }) => {
    routerInstance = router;

    routerInstance.afterEach(async (to, from) => {
        const auth = await isAuthenticated();
        if (auth && to.path === ROUTES.HOME.path) {
            return routerInstance.push(ROUTES.DASHBOARD.path);
        }
    });

    routerInstance.beforeEach(async (to, from) => {
        // check if it's a public route
        if (PUBLIC_ROUTES.some((route) => route.path === to.path)) {
            return;
        }

        // check if the user is authenticated, if not redirect to login page
        const auth = await isAuthenticated();
        if (!auth && to.path !== ROUTES.LOGIN.path) {
            localStorage.setItem('redirectAfterLogin', to.fullPath);
            return ROUTES.LOGIN.path;
        }

        if (to.path === ROUTES.LANDING.path) {
            const redirectAfterLogin =
                localStorage.getItem('redirectAfterLogin');
            if (redirectAfterLogin) {
                return redirectAfterLogin;
            }
        }
        if (auth && to.path === ROUTES.LOGIN.path) {
            return ROUTES.DASHBOARD.path;
        }
    });
});

export { routerInstance };
