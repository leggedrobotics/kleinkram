import { boot } from 'quasar/wrappers';
import { Router } from 'vue-router';

let routerInstance: Router;

// /**
//  * Returns the component of the dashboard for the currently logged-in user
//  *
//  * @param user - the user, if any
//  * @param $authStore - authentication store
//  * @returns the layout component
//  */
// function getUserRoleRoute(
// ): RouteRecordRaw {
//   return ROUTES.HOME;
// }

export default boot(({ router }) => {
    routerInstance = router;

    // if (loggedIn) {
    //   const user = await fetchMyUser();
    //
    //   // Case 2: going to log in when logged in, or to default path '/'
    //   if (!user || to.path === ROUTES.LOGIN.path || to.path === '/') {
    //     return getUserRoleRoute(user, $authStore);
    //   }
    //
    //   // Case 3: role module is active and route has some constraints
    //   if (isModuleActive(MODULES.ROLES)) {
    //     const matchingConstrainedRoute = CONSTRAINED_ROUTES.find(
    //       (constrainedRoute) => constrainedRoute.path === to.path
    //     );
    //     if (matchingConstrainedRoute) {
    //       const hasFullAccess =
    //         user.role &&
    //         matchingConstrainedRoute.allowedRoles.includes(user.role);
    //       if (!hasFullAccess) {
    //         return getUserRoleRoute(user, $authStore);
    //       }
    //     }
    //   }
    // } else if (
    //   !PUBLIC_ROUTES.some((publicRoute) => {
    //     if (publicRoute.path === to.path) {
    //       return true;
    //     }
    //
    //     // Find wildcards in public route
    //     const publicRouteWildcards =
    //       publicRoute.path.match(/(:[A-Za-z0-9]+)\w+/g) ?? [];
    //
    //     // Find indices of wildcards in /-split URL
    //     const splitPublicPath = publicRoute.path.split('/');
    //     const wildcardIndices: number[] = [];
    //     publicRouteWildcards.forEach((wildcard) => {
    //       wildcardIndices.push(splitPublicPath.indexOf(wildcard));
    //     });
    //
    //     const splitToPath = to.path.split('/');
    //
    //     // For every path part, check if it's either a wildcard or matches
    //     // the public path's URL segment at the same index
    //     return splitToPath.every((toPathPart, index) => {
    //       return (
    //         wildcardIndices.includes(index) ||
    //         toPathPart === splitPublicPath[index]
    //       );
    //     });
    //   })
    // ) {
    //   return ROUTES.HOME;
    // }
    // });
});
// Router instance for use in Vue components
export { routerInstance };
