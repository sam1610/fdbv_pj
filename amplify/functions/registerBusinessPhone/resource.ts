import { defineFunction, secret } from '@aws-amplify/backend';

export const registerBusinessPhone = defineFunction({
  name: 'registerBusinessPhone',
  entry: './handler.ts',
  timeoutSeconds: 30, // Meta API calls can take a few seconds
  resourceGroupName: 'data',
  environment: {
    // This tells Amplify to pull the secure secrets and inject them as process.env variables
    WABA_ID: secret('WABA_ID'),
    META_SYSTEM_USER_TOKEN: secret('META_SYSTEM_USER_TOKEN'),
    PUBLIC_KEY: secret('PUBLIC_KEY')
  }
});