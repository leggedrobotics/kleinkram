import {
  RouteLocationNormalizedLoaded,
  Router,
  RouteRecordRaw,
  useRoute,
} from 'vue-router';

/**
 * This is a service that is used globally throughout the application for routing
 */
export default class RouterService {
  // Router instance
  router: Router;

  route: RouteLocationNormalizedLoaded;

  // eslint-disable-next-line require-jsdoc
  constructor(router: Router) {
    console.log('router', router);
    this.router = router;
    this.route = useRoute();
  }

  /**
   * Adds the given string to the URl path
   *
   * @param path - path to route to
   * @param query - query
   * @returns the navigation result.
   */
  addToRoute(
    path: string,
    query: Record<string, string> = {}
  ): ReturnType<typeof this.router.push> {
    let currentRoute = this.route.path;
    if (currentRoute.endsWith('/')) {
      currentRoute = currentRoute.substring(0, currentRoute.length - 1);
    }
    return this.router.push({
      path: `${currentRoute}/${path}`,
      query,
    });
  }

  /**
   * Routes to a given route, as defined in ROUTES constant.
   *
   * @param to - the route to go to.
   * @param query - props to pass to the component, if any.
   * @param keepQuery - keep the current query and add new query parameters if given.
   * @returns the navigation result.
   */
  async routeTo(
    to: RouteRecordRaw,
    query?: Record<string, string>,
    keepQuery = false
  ): ReturnType<typeof this.router.push> {
    if (keepQuery) {
      if (query) {
        return this.router.push({
          path: to.path,
          query: { ...this.route.query, ...query },
        });
      }
      return this.router.push({
        path: to.path,
        query: this.route.query,
      });
    }
    if (query) {
      return this.router.push({
        path: to.path,
        query,
      });
    }
    return this.router.push({
      path: to.path,
    });
  }

  /**
   * Adds given parameters to the URL query.
   *
   * @param params - query parameters.
   * @returns the navigation result.
   */
  async pushToQuery(
    params: Record<string, string>
  ): ReturnType<typeof this.router.push> {
    return this.router.push({
      path: this.route.path,
      query: { ...this.route.query, ...params },
    });
  }

  /**
   * Returns the requested query parameter.
   *
   * @param key - parameter name
   * @returns key - requested parameter
   */
  getQueryParam(key: string): string | null {
    return (this.route.query[key] as string) ?? null;
  }

  /**
   * Returns the requested path parameter.
   *
   * @param key - parameter name
   * @returns key - requested parameter
   */
  getUrlParam(key: string): string | null {
    return (this.route.params[key] as string) ?? null;
  }

  /**
   * Removes the last URL part
   *
   * @returns the navigation result.
   */
  pop(): ReturnType<typeof this.router.push> {
    return this.router.push({
      path: this.route.path.substring(0, this.route.path.lastIndexOf('/')),
    });
  }

  /**
   * Replaces the last URL part with the given new part.
   * Removes all Query parameter
   *
   * @param path - path to route to
   * @returns the navigation result.
   */
  replaceLastPart(path: string): ReturnType<typeof this.router.push> {
    return this.router.push({
      path:
        this.route.path.substring(0, this.route.path.lastIndexOf('/') + 1) +
        path,
    });
  }

  /**
   * Reload page by routing to current route
   * Removes all Query parameter
   */
  reload(): void {
    this.router.go(0);
  }
}
