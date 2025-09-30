import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

// Define the schema for the Product model
const schema = a.schema({
  Product: a.model({
    name: a.string().required(),
    description: a.string(),
    price: a.float().required(),
    inStock: a.boolean().default(true),
  })
  .authorization(allow => [allow.publicApiKey()]), // Use API Key for public access
});

// This is a TypeScript-only export for creating a type-safe client
export type Schema = ClientSchema<typeof schema>;

// Define the data resource
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    }
  },
});