import{defineConfig}from'@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',
  timeout:30000,
  expect:{timeout:7000},
  fullyParallel:false,
  workers:1,
  retries:0,
  use:{headless:true,screenshot:'only-on-failure',trace:'retain-on-failure',video:'retain-on-failure'}
});
