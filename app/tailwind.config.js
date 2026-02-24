/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366f1',
          dark: '#4f46e5',
          light: '#818cf8'
        },
        accent: {
          DEFAULT: '#ec4899',
          dark: '#db2777',
          light: '#f472b6'
        },
        background: {
          DEFAULT: '#0f0f1e',
          secondary: '#1a1a2e',
          tertiary: '#25253d'
        },
        text: {
          primary: '#ffffff',
          secondary: '#b4b4b8',
          muted: '#6b6b70'
        },
      },
      fontFamily: {
        sans: ['System']
      },
    },
  },
  plugins: [],
};
