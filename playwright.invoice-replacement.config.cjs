const {defineConfig}=require('@playwright/test');
const path=require('node:path');
module.exports=defineConfig({testDir:'tests',testMatch:'invoice-replacement-ui.spec.cjs',outputDir:'outputs/replacement-ui',timeout:30000,workers:1,
 use:{baseURL:'http://127.0.0.1:3221',browserName:'chromium',launchOptions:process.env.SPACARE_TEST_CHROME?{executablePath:path.resolve(process.env.SPACARE_TEST_CHROME)}:{}},
 webServer:process.env.SPACARE_UI_EXTERNAL_SERVER ? undefined : {command:'node scripts/test-invoice-replacement-ui.mjs',url:'http://127.0.0.1:3221',reuseExistingServer:false},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}]});
