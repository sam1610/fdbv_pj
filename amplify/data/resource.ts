// import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
// import { optimizeDelivery } from '../functions/optimizeDelivery/resource';
// import { createAgentUser } from '../functions/createAgentUser/resource'; // 1. Import the create function
// import { generatePlanHandler } from '../functions/generate-plan/resource'; // We will create this next
// import { registerBusinessPhone } from '../functions/registerBusinessPhone/resource';
// const orderStatus = ['ORDERED', 'IN_PREPARATION', 'PREPARED', 'DELIVERING', 'DELIVERED'] as const;
// // const stockStatus = ['IN_STOCK', 'OUT_OF_STOCK'] as const;
// const schema = a.schema({
//   OrderStatus: a.enum(orderStatus),
//   // StockStatus: a.enum(stockStatus),
 

//   BusinessData: a
//     .model({
//       // --- Primary Key ---
//       pk: a.string().required(),
//       sk: a.string().required(),
//       entityType: a.string().required(),

//       // --- GSI Attributes ---
//       gsi1pk: a.string(),
//       gsi2pk: a.string(),


// // --- All Possible Entity Attributes ---
// name: a.string(),
// phone: a.string(),
// accessToken: a.string(),
// phoneNumberId: a.string(),
// businessPhone: a.string(),
// orderDate: a.datetime(),
// acceptsMarketing: a.boolean(),
// activeOfferText: a.string(),      // e.g., "15% discount" or "Free Cola"
// activeOfferType: a.string(),      // e.g., "PERCENTAGE" or "FREE_ITEM"
// activeOfferValue: a.float(),      // e.g., 15 (for 15%)
// offerExpiresAt: a.string(),
// totalAmount: a.float(),
// orderStatus: a.ref('OrderStatus'),
// deliveryDate: a.datetime(),
// isPickUp: a.boolean(),
// pickupLocation: a.json(),
// location: a.json(),
// maxCapacity: a.integer(), // For order's number of items
// currentLoad: a.integer(), // For order's number of items
// itemsNbr: a.integer(), // For order's number of items
// // --- Product-specific fields can be added here if needed ---

// deliveryDistance: a.float(),   // Distance in km
// deliveryDuration: a.integer(), // Duration in seconds
// quantity: a.integer(),
// unitPrice: a.float(),
// imageUrl:a.string(),
// description: a.string(),
// itemCategory: a.string(),
// stockStatus: a.boolean(),
// businessOwnerId: a.string(),
// deliveryAgentId: a.string(),
// expiration: a.integer()
//     }).identifier(['pk', 'sk'])
//     .secondaryIndexes((index) => [
//       // list of orders assigned to a delivery agent, filtered by status
//       index('gsi1pk').sortKeys(['sk']).name('ByAgentByStatus').queryField('ByAgent'),
//       // list of orders related to a specific customer
//       index('gsi2pk').sortKeys(['sk']).name('ByCustomer'),
//       index('pk').sortKeys(['sk']).name('ByBusiness').queryField('listByBusiness'),
//       // index('itemCategory').sortKeys(['orderDate']).name('ByCategoryByDate').queryField('listByCategory')
//     ])
//     // ✅ FIX: Updated to the correct syntax for owner-based authorization
//     .authorization((allow) => [

//     allow.groups(['Admins']).to(['create', 'read', 'update']),
//     allow.groups(['DeliveryAgents']).to(['read', 'update']),
//     allow.groups(['ManaDeeb']).to(['read', 'update']),
//     allow.publicApiKey().to(['create', 'update', 'read'])
//     ]),
//   RestaurantMetaAccount: a.model({
//     pk: a.string().required(), 
//     metaBusinessAccessToken: a.string(),
//     phoneNumberId: a.string(),
//     phoneNumber: a.string(),
//     wabaId: a.string(),
//     registrationStatus: a.enum(['PENDING', 'ACTIVE', 'ERROR']),
//     registrationDate: a.datetime(),
//     lastVerified: a.datetime(),
//     businessOwnerId: a.string(), 
//   })
//   .identifier(['pk']) // 🟢 FIX: Set identifier to pk
//   .authorization(allow => [
//     allow.authenticated().to(['read', 'update']),
//     allow.publicApiKey().to(['create', 'read', 'update'])
//   ]),

//   registerPhoneNumber: a
//   .mutation()
//   .arguments({
//     action: a.string(),
//     businessPhone: a.string(),
//     otpCode: a.string(),
//     businessPhoneOwner: a.string(),
//     phoneNumberId: a.string(),
//     verificationMethod: a.string(),
//     businessName: a.string(), 
//   })
//   .returns(a.customType({
//     success: a.boolean(),
//     message: a.string(),
//     data: a.string()
//   }))
//   // Change publicApiKey() to authenticated()
//   .authorization(allow => [allow.authenticated()]) 
//   .handler(a.handler.function(registerBusinessPhone)),
//     optimizeDelivery: a.query()
//       .arguments({
//         orders: a.json(),            // Array of orders passed from React
//         agents: a.json(),            // Array of agents passed from React
//         restaurantLocation: a.json() // {lat, long} passed from React
//       })
//       .returns(
//         a.customType({          // Defined return type for better client intellisense
//         proposal: a.json(),
//         routeMetrics: a.json()
//       })
//       )             // Returns { proposal: [...] }
//       .authorization(allow => [
//          allow.authenticated(),      // Logged in users (Admins/Managers)
//          allow.publicApiKey()        // Optional: if you test without login
//       ])
//       .handler(a.handler.function(optimizeDelivery)),
//       createAgentUser: a.mutation()
//       .arguments({
//         name: a.string().required(),
//         phone: a.string().required(),
//         email: a.string(),
//         businessPhone: a.string().required()
//       })
//       .returns(a.json())
//       .authorization(allow => [
//         allow.groups(['Admins']), // Only Admins can create new agents
//       ])
//       .handler(a.handler.function(createAgentUser)),
//      ForecastResult: a.customType({
//       predictedQuantity: a.integer(),
//       confidence: a.string(), 
//       reasoning: a.string(),
//       seasonalNote: a.string(),
//       suggestedAction: a.string() 
//   }),

//   // 2. NEW: The "Manager" Query
//   // Instead of a.generation(), we use a.handler()
//   generateKitchenPlan: a.query()
//     .arguments({
//       businessPhone: a.string().required(),
//       targetDate: a.string().required(), // e.g. "2025-12-12"
//       category: a.string().required()    // e.g. "SANDWICHES_WRAPS"
//     })
//     .returns(a.ref('ForecastResult'))
//     .handler(a.handler.function(generatePlanHandler)) 
//     .authorization(allow => allow.authenticated()),
// });

// export type Schema = ClientSchema<typeof schema>;

// export const data = defineData({
//   schema,
//   authorizationModes: {
//     // ✅ UPDATED: Changed default authorization mode to API Key
//     defaultAuthorizationMode: 'userPool',
//     apiKeyAuthorizationMode: {
//       description: 'API Key for WhatsApp Flow Lambda',
//       expiresInDays: 365 
//     }
//   },
// });
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { optimizeDelivery } from '../functions/optimizeDelivery/resource';
import { createAgentUser } from '../functions/createAgentUser/resource'; 
import { generatePlanHandler } from '../functions/generate-plan/resource'; 
import { registerBusinessPhone } from '../functions/registerBusinessPhone/resource';


// 🟢 1. NEW IMPORT: Import the sendVipOffer function resource
import { sendVipOffer } from "../functions/sendVipOffer/resource";

const orderStatus = ['ORDERED', 'IN_PREPARATION', 'PREPARED', 'DELIVERING', 'DELIVERED'] as const;

const schema = a.schema({
  OrderStatus: a.enum(orderStatus),

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
      
      // 🟢 The "Digital Wallet" for Marketing
      acceptsMarketing: a.boolean(),
      activeOfferText: a.string(),      // e.g., "15% discount" or "Free Cola"
      activeOfferType: a.string(),      // e.g., "PERCENTAGE" or "FREE_ITEM"
      activeOfferValue: a.float(),      // e.g., 15 (for 15%)
      offerExpiresAt: a.string(),
      lastOfferSentAt: a.datetime(),
      recommendations: a.string(),
      timestamp: a.float(),
      
      totalAmount: a.float(),
      orderStatus: a.ref('OrderStatus'),
      deliveryDate: a.datetime(),
      isPickUp: a.boolean(),
      pickupLocation: a.json(),
      location: a.json(),
      maxCapacity: a.integer(), 
      currentLoad: a.integer(), 
      itemsNbr: a.integer(), 

      deliveryDistance: a.float(),   
      deliveryDuration: a.integer(), 
      quantity: a.integer(),
      unitPrice: a.float(),
      imageUrl: a.string(),
      description: a.string(),
      itemCategory: a.string(),
      stockStatus: a.boolean(),
      businessOwnerId: a.string(),
      deliveryAgentId: a.string(),
      expiration: a.integer()
    }).identifier(['pk', 'sk'])
    .secondaryIndexes((index) => [
      index('gsi1pk').sortKeys(['sk']).name('ByAgentByStatus').queryField('ByAgent'),
      index('gsi2pk').sortKeys(['sk']).name('ByCustomer'),
      index('pk').sortKeys(['sk']).name('ByBusiness').queryField('listByBusiness'),
    ])
    .authorization((allow) => [
      allow.groups(['Admins']).to(['create', 'read', 'update']),
      allow.groups(['DeliveryAgents']).to(['read', 'update']),
      allow.groups(['ManaDeeb']).to(['read', 'update']),
      allow.publicApiKey().to(['create', 'update', 'read'])
    ]),

  RestaurantMetaAccount: a.model({
    pk: a.string().required(), 
    metaBusinessAccessToken: a.string(),
    phoneNumberId: a.string(),
    phoneNumber: a.string(),
    wabaId: a.string(),
    registrationStatus: a.enum(['PENDING', 'ACTIVE', 'ERROR']),
    registrationDate: a.datetime(),
    lastVerified: a.datetime(),
    businessOwnerId: a.string(), 
  })
  .identifier(['pk']) 
  .authorization(allow => [
    allow.authenticated().to(['read', 'update']),
    allow.publicApiKey().to(['create', 'read', 'update'])
  ]),

  registerPhoneNumber: a
    .mutation()
    .arguments({
      action: a.string(),
      businessPhone: a.string(),
      otpCode: a.string(),
      businessPhoneOwner: a.string(),
      phoneNumberId: a.string(),
      verificationMethod: a.string(),
      businessName: a.string(), 
    })
    .returns(a.customType({
      success: a.boolean(),
      message: a.string(),
      data: a.string()
    }))
    .authorization(allow => [allow.authenticated()]) 
    .handler(a.handler.function(registerBusinessPhone)),

  optimizeDelivery: a.query()
    .arguments({
      orders: a.json(),            
      agents: a.json(),            
      restaurantLocation: a.json() 
    })
    .returns(
      a.customType({          
        proposal: a.json(),
        routeMetrics: a.json()
      })
    )             
    .authorization(allow => [
       allow.authenticated(),      
       allow.publicApiKey()        
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
      allow.groups(['Admins']), 
    ])
    .handler(a.handler.function(createAgentUser)),

  ForecastResult: a.customType({
    predictedQuantity: a.integer(),
    confidence: a.string(), 
    reasoning: a.string(),
    seasonalNote: a.string(),
    suggestedAction: a.string() 
  }),

  generateKitchenPlan: a.query()
    .arguments({
      businessPhone: a.string().required(),
      targetDate: a.string().required(), 
      category: a.string().required()    
    })
    .returns(a.ref('ForecastResult'))
    .handler(a.handler.function(generatePlanHandler)) 
    .authorization(allow => allow.authenticated()),

  // 🟢 2. NEW: The VIP Offer AppSync Mutation
  sendVipOffer: a.mutation()
    .arguments({
      businessPhone: a.string().required(),
      customerPhone: a.string().required(),
      customerName: a.string().required(),
      favoriteItem: a.string().required(),
      offerText: a.string().required(),
      offerType: a.string().required(), // e.g., "PERCENTAGE"
      offerValue: a.float().required(), // e.g., 15
      imageUrl: a.string().required(),
      validForHours: a.integer().required() // e.g., 48
    })
    .returns(a.boolean())
    .authorization(allow => [
      allow.authenticated(), 
      allow.publicApiKey()
    ])
    .handler(a.handler.function(sendVipOffer)),
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