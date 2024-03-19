// src/boot/vue-query.js
import { VueQueryPlugin } from '@tanstack/vue-query';

export default ({ app }) => {
  app.use(VueQueryPlugin);
};
