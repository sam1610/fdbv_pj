import { defineFunction, secret } from '@aws-amplify/backend';

export const registerBusinessPhone = defineFunction({
  name: 'registerBusinessPhone',
  entry: './handler.ts',
  resourceGroupName: 'data',
  timeoutSeconds: 15,
  // ✅ ADD THIS ENVIRONMENT BLOCK:
  environment: {
    WABA_ID: secret('WABA_ID'),
    META_SYSTEM_USER_TOKEN: secret('META_SYSTEM_USER_TOKEN')
  }
});