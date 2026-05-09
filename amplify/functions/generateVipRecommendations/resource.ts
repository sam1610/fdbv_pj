import { defineFunction } from '@aws-amplify/backend';
export const generateVipRecommendationsLambda = defineFunction({
  name: 'generateVipRecommendations',
  entry: './handler.ts',
  timeoutSeconds: 30, 
  resourceGroupName: 'data'
});