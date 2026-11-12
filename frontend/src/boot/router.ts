import { defineBoot } from '#q-app';
import ROUTES, { PUBLIC_ROUTES } from 'src/router/routes';
import { isAuthenticated } from 'src/services/auth';
import { Router } from 'vue-router';

const STALE_BUILD_RELOAD_KEY = 'staleBuildReloadedAt';
const STALE_BUILD_RELOAD_COOLDOWN_MS = 30_000;

const CHUNK_LOAD_ERROR_PATTERNS = [
    'Failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'Importing a module script failed',
    'Unable to preload CSS',
];

const isChunkLoadError = (error: unknown): boolean =>
    error instanceof Error &&
    CHUNK_LOAD_ERROR_PATTERNS.some((pattern) =>
        error.message.includes(pattern),
    );

/**
 * A deployment replaces the hashed files in /assets. A tab that was opened
 * before the deployment still asks for the old file names when it loads a
 * route or component for the first time, and gets a 404.
 *
 * Loading the page again fetches the current index.html. The cooldown keeps
 * a chunk that is missing for another reason from reloading in a loop.
 */
const reloadOnStaleBuild = (target: string): void => {
    const lastReload = Number(sessionStorage.getItem(STALE_BUILD_RELOAD_KEY));
    if (Date.now() - lastReload < STALE_BUILD_RELOAD_COOLDOWN_MS) return;

    sessionStorage.setItem(STALE_BUILD_RELOAD_KEY, Date.now().toString());
    globalThis.location.assign(target);
};

let routerInstance: Router;
export default defineBoot(({ router }: { router: Router }) => {
    routerInstance = router;

    // the page the user is on their way to, so a reload ends up there
    let pendingNavigation: string | undefined;
    routerInstance.beforeEach((to) => {
        pendingNavigation = to.fullPath;
    });
    routerInstance.afterEach(() => {
        pendingNavigation = undefined;
    });

    // Vite raises this for every lazy import that fails to load, both for
    // routes and for components loaded on demand, e.g. the viewers
    globalThis.addEventListener('vite:preloadError', () => {
        reloadOnStaleBuild(pendingNavigation ?? globalThis.location.href);
    });

    routerInstance.onError((error: unknown, to) => {
        if (isChunkLoadError(error)) reloadOnStaleBuild(to.fullPath);
    });

    routerInstance.afterEach(async (to) => {
        const auth = await isAuthenticated();
        if (auth && to.path === ROUTES.HOME.path) {
            return routerInstance.push(ROUTES.DASHBOARD.path);
        }
    });

    routerInstance.beforeEach(async (to) => {
        // check if it's a public route
        if (PUBLIC_ROUTES.some((route) => route.path === to.path)) {
            return;
        }

        // check if the user is authenticated, if not redirect to login page
        const auth = await isAuthenticated();
        if (!auth && to.path !== ROUTES.LOGIN.path) {
            // Save the target route to redirect after login
            localStorage.setItem('redirectAfterLogin', to.fullPath);
            return ROUTES.LOGIN.path;
        }

        if (to.path === ROUTES.LANDING.path) {
            const redirectAfterLogin =
                localStorage.getItem('redirectAfterLogin');
            if (redirectAfterLogin) {
                // If a target after login is saved, redirect to it
                return redirectAfterLogin;
            }
        }
        if (auth && to.path === ROUTES.LOGIN.path) {
            return ROUTES.DASHBOARD.path;
        }
    });
});

export { routerInstance };
