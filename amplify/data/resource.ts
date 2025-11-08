import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

// Define all necessary status enums for data consistency
const orderStatus = ['ORDERED', 'IN_PREPARATION', 'PREPARED', 'DELIVERING', 'DELIVERED'] as const;
const stockStatus = ['IN_STOCK', 'OUT_OF_STOCK'] as const;

const schema = a.schema({
  OrderStatus: a.enum(orderStatus),
  StockStatus: a.enum(stockStatus),

  BusinessData: a
    .model({
      // --- Primary Key ---
      pk: a.string().required(),
      sk: a.string().required(),
      entityType: a.string().required(),

      // --- GSI Attributes ---
      gsi1pk: a.string(),
      gsi2pk: a.string(),


// --- All Possible Entity Attributes ---
name: a.string(),
phone: a.string(),
orderDate: a.datetime(),
totalAmount: a.float(),
orderStatus: a.ref('OrderStatus'),
deliveryDate: a.datetime(),
location: a.json(),
itemsNbr: a.integer(), // For order's number of items
// --- Product-specific fields can be added here if needed ---
quantity: a.integer(),
unitPrice: a.float(),
imageUrl:a.string(),
description: a.string(),
stockStatus: a.ref('StockStatus'),
businessOwnerId: a.string(),
deliveryAgentId: a.string()
    }).identifier(['pk', 'sk'])
    .secondaryIndexes((index) => [
      // list of orders assigned to a delivery agent, filtered by status
      index('gsi1pk').sortKeys(['sk']).name('ByAgentByStatus'),
      // list of orders related to a specific customer
      index('gsi2pk').sortKeys(['sk']).name('ByCustomer'),
    ])
    // ✅ FIX: Updated to the correct syntax for owner-based authorization
    .authorization((allow) => [

      allow.ownerDefinedIn('businessOwnerId').to(['create', 'read', 'update', 'delete']),
      // Delivery Agents can only read records they own.
      allow.ownerDefinedIn('deliveryAgentId').to(['read']),
      // Any authenticated user can create and read records.
      allow.authenticated().to(['create', 'read']),
      allow.publicApiKey().to(['create'])// Restrict to 'create' for security; add more if needed (e.g., 'update')

    ]),

    // --- Custom Mutations remain the same ---
    createDeliveryAgent: a.mutation()
      .arguments({ 
        username: a.string().required(), 
        email: a.email().required(),
        phoneNumber: a.phone().required()
      })
      .returns(a.string())
      .authorization((allow) => [allow.groups(['Admins'])])
      .handler(a.handler.function('addDeliveryAgentHandler')),

    deliverOrder: a.mutation()
      .arguments({ orderPk: a.string().required(), orderSk: a.string().required() })
      .returns(a.ref('BusinessData'))
      .authorization((allow) => [allow.groups(['DeliveryAgents'])])
      .handler(a.handler.function('deliverOrderHandler')),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      description: 'API Key for WhatsApp Flow Lambda',
      expiresInDays: 365 
    }
  },
});