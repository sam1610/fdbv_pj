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
      gsi1sk: a.string(),
      gsi2pk: a.string(),
      gsi2sk: a.string(),
      gsi3pk: a.string(),
      gsi3sk: a.string(),
      gsi4pk: a.string(),
      gsi4sk: a.string(),
      
      // --- All Possible Entity Attributes ---
      name: a.string(),
      phone: a.phone(),
      orderDate: a.datetime(),
      totalPrice: a.float(),
      orderStatus: a.ref('OrderStatus'),
      customerId: a.string(),
      deliveryAgentId: a.string(), 
      deliveryDate: a.datetime(),
      details: a.json(),
      
      // Add a field to store the Cognito ID of the business owner (Admin)
      businessOwnerId: a.string(),

      // --- Product-specific fields can be added here if needed ---
      productId: a.string(),
      quantity: a.integer(),
      unitPrice: a.float(),
    })
    .secondaryIndexes((index) => [
      index('gsi1pk').sortKeys(['gsi1sk']).queryField('listBusinessDataByBusinessByStatus'),
      index('gsi2pk').sortKeys(['gsi2sk']).queryField('listBusinessDataByBusinessByEntity'),
      index('gsi3pk').sortKeys(['gsi3sk']).queryField('listBusinessDataByAgentByStatus'),
      index('gsi4pk').sortKeys(['gsi4sk']).queryField('listBusinessDataByCustomer'),
    ])
    // ✅ FIX: Updated to the correct syntax for owner-based authorization
    .authorization((allow) => [
      // An Admin can perform all actions ONLY on records they own.
      allow.ownerDefinedIn('businessOwnerId').to(['create', 'read', 'update', 'delete']),
      // allow.groups(['Admins']).to(['create', 'read', 'update', 'delete']),
      // A Delivery Agent can only read records they own.
      allow.ownerDefinedIn('deliveryAgentId').to(['read']),
      
      // Any authenticated user can create and read records.
      // allow.authenticated().to(['create', 'read']),
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
  },
});