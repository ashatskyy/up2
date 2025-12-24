import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
	base: '/up2/',
	plugins: [react()],
})
