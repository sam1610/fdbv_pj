import { defineFunction } from '@aws-amplify/backend';

export const sendVipOffer = defineFunction({
  name: 'sendVipOffer',
  entry: './handler.ts'
});