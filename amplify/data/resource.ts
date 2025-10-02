// amplify/data/resource.ts

import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

// Define an enum for inventory status to ensure data consistency
const inventoryStatus = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const schema = a.schema({
  // Define the enum type within the schema
  InventoryStatus: a.enum(inventoryStatus),

  Product: a
    .model({
      name: a.string().required(),
      description: a.string(),
      price: a.float().required(),
      inStock: a.boolean().default(true),
      category: a.string(),
      orderDate: a.datetime(),
      ingredients: a.string().array(),
      calories: a.integer(),
      allergens: a.string().array(),
      imageUrl: a.url(),
      inventoryStatus: a.ref('InventoryStatus').required(),
    })
    .authorization((allow) => [allow.publicApiKey()])
    
    // ✅ FIX: Use an array [] and the .name() modifier for each index
    .secondaryIndexes((index) => [
      index('inStock').sortKeys(['orderDate']).name('byStockStatus'),
      index('inventoryStatus').sortKeys(['price']).name('byInventoryStatus'),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});