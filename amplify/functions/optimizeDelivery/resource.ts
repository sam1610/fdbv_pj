import { defineFunction } from '@aws-amplify/backend';

export const optimizeDelivery = defineFunction({
  name: 'optimizeDelivery',
  entry: './handler.ts', // We will create this next
  timeoutSeconds: 60, // Route calculations can take a few seconds
});