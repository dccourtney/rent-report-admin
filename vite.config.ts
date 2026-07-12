import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Different port from the main app (5174) so both can run at once.
    port: 5175,
    open: true,
  },
});
