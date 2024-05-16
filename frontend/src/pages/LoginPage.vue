<template>
  <div>
    <h1>Login</h1>
    <form @submit.prevent="login">
      <label>
        Email:
        <input type="email" v-model="email" required />
      </label>
      <label>
        Password:
        <input type="password" v-model="password" required />
      </label>
      <button type="submit">Login</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { isAuthenticated } from '../services/auth';

const email = ref('');
const password = ref('');
const router = useRouter();

const login = async () => {
  // Here you would call your authentication service
  // For now, we'll just simulate a successful login
  localStorage.setItem('token', 'your-token');
  if (isAuthenticated()) {
    router.push({ name: 'Home' }); // Redirect to home page after successful login
  }
};
</script>

<style scoped>
label {
  display: block;
  margin-bottom: 1em;
}
</style>
