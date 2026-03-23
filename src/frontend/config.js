// src/frontend/config.js
// Update this with your Arch Linux machine's IP address
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// To use from another computer, change localhost to your server's IP:
// export const API_URL = 'http://192.168.1.100:3000/api';

// Or set it via environment variable:
// VITE_API_URL=http://192.168.1.100:3000/api npm run dev