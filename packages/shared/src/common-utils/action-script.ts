/**
 * Constants shared by everything that touches single-file Python actions
 * (`klein action run-script`).
 */

/**
 * Name of the admin-managed template every script action runs on.
 *
 * `ActionEntity.template` is not nullable, so a script action is still a normal
 * action pointing at a normal template. There is exactly one such template for
 * the whole deployment; the script it runs is handed to the container through
 * `KLEINKRAM_SCRIPT_URL` instead of being baked into an image.
 */
export const SCRIPT_RUNNER_TEMPLATE_NAME = 'script-runner';

/**
 * Largest script body accepted by the API, in bytes.
 *
 * A single analysis script is a few kilobytes; anything approaching this is
 * either generated, vendored dependencies, or a mistake, and belongs in a real
 * Docker action instead.
 */
export const MAX_ACTION_SCRIPT_BYTES = 1024 * 1024;

/**
 * Image the seeded `script-runner` template points at.
 *
 * Deployments that mirror images internally override this with
 * `SCRIPT_RUNNER_IMAGE` and re-point the template; the seed only provides a
 * working default so `run-script` is usable on a fresh instance.
 */
export const SCRIPT_RUNNER_DEFAULT_IMAGE =
    'rslethz/action:script-runner-latest';

/** Fixed uuid of the seeded template, so every deployment agrees on it. */
export const SCRIPT_RUNNER_TEMPLATE_UUID =
    '00000000-0000-4000-8000-00000000c0de';
