import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './i18n'
// Bundled fonts: Maple Mono for Latin, Maple Mono CN for 中文. The CN build is
// split into unicode-range chunks (cn-font-split), so the browser only fetches
// the glyph ranges actually rendered on the page.
import '@fontsource/maple-mono/300.css'
import '@fontsource/maple-mono/400.css'
import '@fontsource/maple-mono/400-italic.css'
import '@fontsource/maple-mono/500.css'
import '@fontsource/maple-mono/700.css'
import '@mogeko/maple-mono-cn/dist/font/result.css'
import './styles/app.css'

createApp(App).use(i18n).mount('#app')
