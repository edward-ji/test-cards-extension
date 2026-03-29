import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/webextension-polyfill'],
  webExt: {
    startUrls: ['https://mystoredemo.io'],
  },
  manifest: ({ browser }) => ({
    name: 'Test Cards',
    version: '0.4.0',
    description: 'Copy and prefill test card numbers and other payment methods with a single click.',
    action: {
      default_title: 'Test Cards',
    },
    icons: {
      16: 'images/icon-16.png',
      48: 'images/icon-48.png',
      128: 'images/icon-128.png',
    },
    permissions: [
      'scripting',
      'activeTab',
      'storage',
      'webNavigation',
    ],
    host_permissions: ['https://*/*', 'http://*/*'],
    web_accessible_resources: [
      {
        resources: ['/data/*.json'],
        matches: ['https://*/*', 'http://*/*'],
      },
    ],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'test-cards-extension@edwardji.dev',
          strict_min_version: '142.0',
          data_collection_permissions: {
            required: ['none'],
          },
        },
      },
    }),
  }),
});
