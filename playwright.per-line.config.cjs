const {defineConfig,devices}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'tests',
  testMatch:'per-line-performers-ui.spec.cjs',
  workers:1,
  retries:0,
  timeout:30_000,
  outputDir:'/artifacts/test-results',
  reporter:[['list'],['html',{outputFolder:'/artifacts/html',open:'never'}]],
  use:{
    baseURL:process.env.SPACARE_UI_BASE_URL,
    browserName:'chromium',
    screenshot:'only-on-failure',
    trace:'retain-on-failure',
  },
  projects:[
    {name:'desktop',use:{viewport:{width:1440,height:900}}},
    {name:'mobile',use:{...devices['Pixel 7'],viewport:{width:412,height:915}}},
  ],
});
