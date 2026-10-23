// Optional browser suite: requires @playwright/test and a local Chromium installation.
import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests',testMatch:'input-ui.spec.mjs',use:{baseURL:'http://127.0.0.1:3219',browserName:'chromium'},webServer:{command:'node scripts/test-input-ui.mjs',url:'http://127.0.0.1:3219/workspace/packages',reuseExistingServer:false},projects:[{name:'desktop',use:{viewport:{width:1440,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}]});
