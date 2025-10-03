import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

// Define all necessary status enums for data consistency
const orderStatus = ['ORDERED', 'IN_PREPARATION', 'PREPARED', 'DELIVERING', 'DELIVERED'] as const;
const stockStatus = ['IN_STOCK', 'OUT_OF_STOCK'] as const;

const schema = a.schema({
  OrderStatus: a.enum(orderStatus),
  StockStatus: a.enum(stockStatus),

  // This single model represents all data types in our table (e.g., Businesses, Orders, Customers).
  BusinessData: a
    .model({
      // --- Primary Key (The "Address" of the data) ---
      pk: a.string().required(),
      sk: a.string().required(),
      entityType: a.string().required(),

      // --- GSI Attributes (The "Indexes" for querying) ---
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

      // Product-specific fields
      description: a.string(),
      price: a.float(),
      stockStatus: a.ref('StockStatus'),
      category: a.string(),
      ingredients: a.string().array(),
      calories: a.integer(),
      allergens: a.string().array(),
      imageUrl: a.url(),

      productId: a.string(),
      quantity: a.integer(),
      unitPrice: a.float(),
    })
    .secondaryIndexes((index) => [
      // GSI 1: For the Business Admin Dashboard
      index('gsi1pk').sortKeys(['gsi1sk']).queryField('listBusinessDataByBusinessByStatus'),
      
      // GSI 2: For Business Relationship Management
      index('gsi2pk').sortKeys(['gsi2sk']).queryField('listBusinessDataByBusinessByEntity'),

      // GSI 3: For the Delivery Agent's Dashboard (Sparse Index)
      index('gsi3pk').sortKeys(['gsi3sk']).queryField('listBusinessDataByAgentByStatus'),
      
      // GSI 4: For the Customer's Order History
      index('gsi4pk').sortKeys(['gsi4sk']).queryField('listBusinessDataByCustomer'),
    ])
    // ✅ FIX: Replaced .operations() with the correct .to() method
    .authorization((allow) => [
      allow.groups(['Admins']).to(['create', 'read', 'update', 'delete']),
      allow.ownerDefinedIn('deliveryAgentId').to(['read']),
      allow.authenticated().to(['create', 'read']),
    ]),

    // --- Custom Mutations for Secure Business Logic ---
    createDeliveryAgent: a.mutation()
      .arguments({ username: a.string().required(), email: a.email().required() })
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