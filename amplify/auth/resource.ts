import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true, // Enable email/password sign-in
  },
  groups: ['Admins', 'DeliveryAgents'], // Define groups used in schema
});