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
 * Fixed uuid of the seeded template, so every deployment agrees on it. The
 * migration that seeds it carries its own copy, as migrations must not change
 * when shared code does.
 */
export const SCRIPT_RUNNER_TEMPLATE_UUID =
    '00000000-0000-4000-8000-00000000c0de';
