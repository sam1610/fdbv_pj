import { defineFunction } from '@aws-amplify/backend';

export const createAgentUser = defineFunction({
  name: 'createAgentUser',
  entry: './handler.ts',
   resourceGroupName: 'data'
  // We will inject the User Pool ID via environment variables in backend.ts
});