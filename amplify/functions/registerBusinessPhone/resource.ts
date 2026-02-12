import { defineFunction } from '@aws-amplify/backend';

export const registerBusinessPhone = defineFunction({
  name: 'registerBusinessPhone',
  entry: './handler.ts'

});