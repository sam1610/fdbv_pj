import { defineFunction } from '@aws-amplify/backend';

export const generatePlanHandler = defineFunction({
  name: 'generate-plan-handler',
  entry: './handler.ts',
  timeoutSeconds: 60,
  resourceGroupName: 'data', // <--- ADD THIS LINE
});