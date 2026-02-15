import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { optimizeDelivery } from '../functions/optimizeDelivery/resource';
import { createAgentUser } from '../functions/createAgentUser/resource'; // 1. Import the create function
import { generatePlanHandler } from '../functions/generate-plan/resource'; // We will create this next
import { registerBusinessPhone } from '../functions/registerBusinessPhone/resource';
// Define all necessary status enums for data consistency
const orderStatus = ['ORDERED', 'IN_PREPARATION', 'PREPARED', 'DELIVERING', 'DELIVERED'] as const;
// const stockStatus = ['IN_STOCK', 'OUT_OF_STOCK'] as const;
const schema = a.schema({
  OrderStatus: a.enum(orderStatus),
  // StockStatus: a.enum(stockStatus),
 

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
accessToken: a.string(),
phoneNumberId: a.string(),
businessPhone: a.string(),
orderDate: a.datetime(),
totalAmount: a.float(),
orderStatus: a.ref('OrderStatus'),
deliveryDate: a.datetime(),
isPickUp: a.boolean(),
pickupLocation: a.json(),
location: a.json(),
maxCapacity: a.integer(), // For order's number of items
currentLoad: a.integer(), // For order's number of items
itemsNbr: a.integer(), // For order's number of items
// --- Product-specific fields can be added here if needed ---

deliveryDistance: a.float(),   // Distance in km
deliveryDuration: a.integer(), // Duration in seconds
quantity: a.integer(),
unitPrice: a.float(),
imageUrl:a.string(),
description: a.string(),
itemCategory: a.string(),
stockStatus: a.boolean(),
businessOwnerId: a.string(),
deliveryAgentId: a.string(),
expiration: a.integer()
    }).identifier(['pk', 'sk'])
    .secondaryIndexes((index) => [
      // list of orders assigned to a delivery agent, filtered by status
      index('gsi1pk').sortKeys(['sk']).name('ByAgentByStatus').queryField('ByAgent'),
      // list of orders related to a specific customer
      index('gsi2pk').sortKeys(['sk']).name('ByCustomer'),
      index('pk').sortKeys(['sk']).name('ByBusiness').queryField('listByBusiness'),
      // index('itemCategory').sortKeys(['orderDate']).name('ByCategoryByDate').queryField('listByCategory')
    ])
    // ✅ FIX: Updated to the correct syntax for owner-based authorization
    .authorization((allow) => [

    allow.groups(['Admins']).to(['create', 'read', 'update']),
    allow.groups(['DeliveryAgents']).to(['read', 'update']),
    allow.groups(['ManaDeeb']).to(['read', 'update']),
    allow.publicApiKey().to(['create', 'update', 'read'])
    ]),
  RestaurantMetaAccount: a.model({
    restaurantId: a.string().required(), // PK - Business Phone
    metaBusinessAccessToken: a.string(),
    phoneNumberId: a.string(),
    phoneNumber: a.string(),
    wabaId: a.string(),
    registrationStatus: a.enum(['PENDING', 'ACTIVE', 'ERROR']),
    registrationDate: a.datetime(),
    lastVerified: a.datetime(),
    businessOwnerId: a.string(), // 🆕 Link to owner
  })
  .identifier(['restaurantId'])
  .authorization(allow => [
    allow.authenticated().to(['read', 'update']),
    allow.publicApiKey().to(['create', 'read', 'update'])
  ]),

    registerPhoneNumber: a.mutation()
    .arguments({
      action: a.string().required(),
        businessPhone: a.string().required(),
        otpCode: a.string(),
        businessPhoneOwner: a.string(),
        phoneNumberId: a.string(),
        verificationMethod: a.string() 
    })
    .returns(a.json())
    .authorization(allow => [
      allow.authenticated()
    ])
    .handler(a.handler.function(registerBusinessPhone)),
    optimizeDelivery: a.query()
      .arguments({
        orders: a.json(),            // Array of orders passed from React
        agents: a.json(),            // Array of agents passed from React
        restaurantLocation: a.json() // {lat, long} passed from React
      })
      .returns(
        a.customType({          // Defined return type for better client intellisense
        proposal: a.json(),
        routeMetrics: a.json()
      })
      )             // Returns { proposal: [...] }
      .authorization(allow => [
         allow.authenticated(),      // Logged in users (Admins/Managers)
         allow.publicApiKey()        // Optional: if you test without login
      ])
      .handler(a.handler.function(optimizeDelivery)),
      createAgentUser: a.mutation()
      .arguments({
        name: a.string().required(),
        phone: a.string().required(),
        email: a.string(),
        businessPhone: a.string().required()
      })
      .returns(a.json())
      .authorization(allow => [
        allow.groups(['Admins']), // Only Admins can create new agents
      ])
      .handler(a.handler.function(createAgentUser)),
     ForecastResult: a.customType({
      predictedQuantity: a.integer(),
      confidence: a.string(), 
      reasoning: a.string(),
      seasonalNote: a.string(),
      suggestedAction: a.string() 
  }),

  // 2. NEW: The "Manager" Query
  // Instead of a.generation(), we use a.handler()
  generateKitchenPlan: a.query()
    .arguments({
      businessPhone: a.string().required(),
      targetDate: a.string().required(), // e.g. "2025-12-12"
      category: a.string().required()    // e.g. "SANDWICHES_WRAPS"
    })
    .returns(a.ref('ForecastResult'))
    .handler(a.handler.function(generatePlanHandler)) 
    .authorization(allow => allow.authenticated()),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    // ✅ UPDATED: Changed default authorization mode to API Key
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      description: 'API Key for WhatsApp Flow Lambda',
      expiresInDays: 365 
    }
  },
});