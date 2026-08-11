/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                woo: {
                    primary: '#96588a',  // بنفش اصلی ووکامرس
                    dark: '#714168',     // بنفش تیره برای دکمه‌ها
                    light: '#f3f0f2',    // پس‌زمینه روشن
                },
            },
        },
    },
    plugins: [],
};