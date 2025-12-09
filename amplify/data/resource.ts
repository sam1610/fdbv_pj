import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { optimizeDelivery } from '../functions/optimizeDelivery/resource';
import { createAgentUser } from '../functions/createAgentUser/resource'; // 1. Import the create function

// Define all necessary status enums for data consistency
const orderStatus = ['ORDERED', 'IN_PREPARATION', 'PREPARED', 'DELIVERING', 'DELIVERED'] as const;
const stockStatus = ['IN_STOCK', 'OUT_OF_STOCK'] as const;
const itemCategories = [
    // --- The Core Courses ---
    'STARTERS',          // Appetizers, Wings, Dim Sum
    'MAIN_COURSE',       // General Plates, Steaks, Rice Dishes
    'BREAKFAST',         // Eggs, Pancakes, Morning items
    'LUNCH_SPECIALS',    // Time-limited items
    
    // --- Specific Food Types (That often stand alone) ---
    'SALADS',            // Greenery, Caesar, etc.
    'SOUPS',             // Broths, Chowders
    'SANDWICHES_WRAPS',  // Burgers, Paninis, Shawarma
    'PIZZA_PASTA',       // Italian staples usually get their own category
    
    // --- Complements ---
    'SIDES',             // Fries, Rice, Steamed Veggies
    'SAUCES_EXTRAS',     // Extra Ketchup, Mayo, Bread (Crucial for upselling)
    
    // --- Beverages ---
    'DRINKS_COLD',       // Sodas, Water, Juices
    'DRINKS_HOT',        // Coffee, Tea, Hot Chocolate
    'SMOOTHIES_SHAKES',  // Blended drinks
    
    // --- Special Segments ---
    'DESSERTS',          // Cakes, Ice Cream
    'KIDS_MEAL',         // Smaller portions, Nuggets
    'BUNDLES_DEALS',     // Family Packs, "Meal for 2" (High Revenue Items)
    'HEALTHY_DIET'       // Keto, Vegan specific bowls
] as const;
const schema = a.schema({
  OrderStatus: a.enum(orderStatus),
  StockStatus: a.enum(stockStatus),
  ItemCategory: a.enum(itemCategories),

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
isPickUp: a.boolean(),
location: a.json(),
itemsNbr: a.integer(), // For order's number of items
// --- Product-specific fields can be added here if needed ---
quantity: a.integer(),
unitPrice: a.float(),
imageUrl:a.string(),
description: a.string(),
itemCategory: a.ref('ItemCategory'),
stockStatus: a.ref('StockStatus'),
businessOwnerId: a.string(),
deliveryAgentId: a.string()
    }).identifier(['pk', 'sk'])
    .secondaryIndexes((index) => [
      // list of orders assigned to a delivery agent, filtered by status
      index('gsi1pk').sortKeys(['sk']).name('ByAgentByStatus').queryField('ByAgent'),
      // list of orders related to a specific customer
      index('gsi2pk').sortKeys(['sk']).name('ByCustomer'),
      index('pk').sortKeys(['sk']).name('ByBusiness').queryField('listByBusiness'),
      index('itemCategory').sortKeys(['orderDate']).name('ByCategoryByDate').queryField('listByCategory')
    ])
    // ✅ FIX: Updated to the correct syntax for owner-based authorization
    .authorization((allow) => [

    allow.groups(['Admins']).to(['create', 'read', 'update']),
    allow.groups(['DeliveryAgents']).to(['read', 'update']),
    allow.publicApiKey().to(['create', 'update', 'read']),

    ]),
 
    calculateRoutePlan: a.query()
      .arguments({
        orders: a.json(),            // Array of orders passed from React
        agents: a.json(),            // Array of agents passed from React
        restaurantLocation: a.json() // {lat, long} passed from React
      })
      .returns(a.json())             // Returns { proposal: [...] }
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
      seasonalNote: a.string() // e.g., "Demand increased due to Summer weekend trends"
  }),
predictInventory: a.generation({
    aiModel: a.ai.model('Claude 3.5 Sonnet'),
    systemPrompt: `You are an expert Restaurant Inventory Planner.
      Analyze the provided JSON sales history.
      
      Variables to consider:
      1. **Target Date:** Check the day of week and month (Seasonality).
      2. **Time Segment:** If 'Lunch' vs 'Dinner' is specified, adjust predictions based on typical dining habits for the item category.
      3. **Category:** Must be one of [${itemCategories.join(', ')}]. 
         - Note that 'BUNDLES_DEALS' often spike on weekends.
         - 'LUNCH_SPECIALS' spike on weekdays 11am-2pm.
         - 'BREAKFAST' spikes 7am-11am.

      Output a JSON response matching the ForecastResult type.
      IMPORTANT OUTPUT RULES:
      - 'predictedQuantity' must be an integer (no decimals).
      - 'confidence' must be exactly one of: 'HIGH', 'MEDIUM', 'LOW'.`
  })
  .arguments({
    targetDate: a.string(),       // "2025-12-08"
    category: a.string(),         // "Burgers" or "Specific Item Name"
    timeSegment: a.string(),      // "Lunch", "Dinner", or "All Day"
    historySummary: a.json()      // Last 30 days of aggregated data
  })
  .returns(a.ref('ForecastResult'))
  .authorization(allow => allow.authenticated())
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