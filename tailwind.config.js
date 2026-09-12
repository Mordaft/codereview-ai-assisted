/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,html}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: { light: '#1c2926', dark: '#edf5ef' },
          secondary: { light: '#c4f36b', dark: '#b3df5e' },
          accent: { light: '#87b743', dark: '#a9d85c' },
          info: { light: '#6395e6', dark: '#8fb5f0' },
          warning: { light: '#f0bd46', dark: '#f4ca68' },
          canvas: { light: '#f5f8f6', dark: '#15211e' },
          surface: { light: '#ffffff', dark: '#24332e' },
          muted: { light: '#77827e', dark: '#a4b2aa' },
          line: { light: '#e1e8e4', dark: '#35453e' },
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
