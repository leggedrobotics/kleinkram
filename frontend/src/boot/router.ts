import {boot} from 'quasar/wrappers';
import {Router} from 'vue-router';
import {isAuthenticated} from 'src/services/auth';
import ROUTES, {PUBLIC_ROUTES} from 'src/router/routes';
import {useQuery} from "@tanstack/vue-query";
import {getMe} from "src/services/queries/user";

let routerInstance: Router;

export default boot(({router}) => {
    routerInstance = router;

    routerInstance.beforeEach(async (to, from) => {

        // check if it's a public route
        if (PUBLIC_ROUTES.some((route) => route.path === to.path)) {
            return;
        }

        // check if the user is authenticated, if not redirect to login page
        const auth = await isAuthenticated();
        if (!auth && to.path !== ROUTES.LOGIN.path) {
            return ROUTES.LOGIN.path;
        }
        if(auth && to.path === ROUTES.LOGIN.path) {
            return ROUTES.HOME.path;
        }

    });
});

export {routerInstance};
