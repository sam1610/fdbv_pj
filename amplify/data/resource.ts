import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

// Define enums for our status fields
const stockStatus = ['IN_STOCK', 'OUT_OF_STOCK'] as const;
const inventoryStatus = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const schema = a.schema({
  // ✅ FIX: Define enums as top-level types in the schema
  StockStatus: a.enum(stockStatus),
  InventoryStatus: a.enum(inventoryStatus),

  Product: a
    .model({
      name: a.string().required(),
      description: a.string(),
      price: a.float().required(),
      
      // Use a.ref() to reference the enum and make it required.
      // The .default() value must be handled in your client-side code.
      stockStatus: a.ref('StockStatus').required(),

      category: a.string(),
      orderDate: a.datetime(),
      ingredients: a.string().array(),
      calories: a.integer(),
      allergens: a.string().array(),
      imageUrl: a.url(),
      
      // Use a.ref() for the second enum as well for consistency
      inventoryStatus: a.ref('InventoryStatus').required(),
    })
    .authorization((allow) => [allow.publicApiKey()])
    .secondaryIndexes((index) => [
      // GSI 1 is based on the 'stockStatus' string field
      index('stockStatus').sortKeys(['orderDate']).name('byStockStatus'),
      
      // GSI 2 remains the same
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

