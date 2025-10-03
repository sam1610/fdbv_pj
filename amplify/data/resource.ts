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
      // The combination of pk + sk must be unique and is IMMUTABLE.
      pk: a.string().required(), // e.g., "BUSINESS#B123" or "ORDER#O789"
      sk: a.string().required(), // e.g., "METADATA#B123" for a main record or "ITEM#P001" for a line item
      
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
      // Purpose: To list all Orders for a specific Business, with the ability to filter by status.
      // PK: The Business ID, to group all orders for that business.
      // SK: A composite key of Status + Timestamp, for filtering and chronological sorting.
      // Example Query: "Get all 'PREPARED' orders for Business B123, newest first."
      index('gsi1pk').sortKeys(['gsi1sk']).name('byBusinessByStatus'),
      
      // GSI 2: For Business Relationship Management
      // Purpose: To list all related entities (like Customers and Delivery Agents) for a specific Business.
      // PK: The Business ID, to group all related entities.
      // SK: The entity type + ID, to distinguish between customers and agents.
      // Example Query: "Get all Customers for Business B123."
      index('gsi2pk').sortKeys(['gsi2sk']).name('byBusinessByEntity'),

      // GSI 3: For the Delivery Agent's Dashboard (Sparse Index)
      // Purpose: To list only the active, "DELIVERING" orders assigned to a specific agent.
      // PK: The Agent's ID, to get only their orders.
      // SK: A composite key of Status + Timestamp, to ensure only 'DELIVERING' orders appear.
      // This is a "sparse index": items only appear in this GSI when their status is 'DELIVERING'.
      // Example Query: "Get my current delivery assignments."
      index('gsi3pk').sortKeys(['gsi3sk']).name('byAgentByStatus'),
      
      // GSI 4: For the Customer's Order History
      // Purpose: To list all orders placed by a specific customer, sorted chronologically.
      // PK: The Customer's ID.
      // SK: The order timestamp, for sorting.
      // Example Query: "Get my complete order history, newest first."
      index('gsi4pk').sortKeys(['gsi4sk']).name('byCustomer'),
    ])
    .authorization((allow) => [
      allow.groups(['Admins']).operations(['create', 'read', 'update', 'delete']),
      allow.owner('deliveryAgentId').operations(['read']),
      allow.authenticated().operations(['create', 'read']),
    ]),

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

