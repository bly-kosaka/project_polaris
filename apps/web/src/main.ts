import { clerkPlugin } from '@clerk/vue';
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './styles/tokens.css';
import './styles/base.css';

createApp(App)
  .use(clerkPlugin, { publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY })
  .use(router)
  .mount('#app');
