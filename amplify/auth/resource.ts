import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true, // Enable email/password sign-in
  },
    userAttributes: {
    // Add phone number as a standard attribute that can be stored for users.
    // This makes it retrievable via the Amplify client libraries.
    phoneNumber: {
      mutable: true,
      required: true, // We will require this when creating new agents.
    },
  },
  groups: ['Admins', 'DeliveryAgents'], // Define groups used in schema
});