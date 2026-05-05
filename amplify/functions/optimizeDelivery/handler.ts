// import { GeoRoutesClient, CalculateRouteMatrixCommand } from "@aws-sdk/client-geo-routes";

// const client = new GeoRoutesClient({ region: "us-east-1" });

// // --- CONFIGURATION ---
// const DEFAULT_MAX_CAPACITY = 10; 

// // Helper: Calculate Load Units based on order size (Big=4, Med=2, Regular=1)
// const getOrderLoad = (order: any): number => {
//   const size = order.size || 'REGULAR';
//   switch (size.toString().toUpperCase()) {
//       case 'BIG': return 4;
//       case 'MEDIUM': return 2;
//       default: return 1;
//   }
// };

// export const handler = async (event: any) => {
//   // 1. Parsing Helper (Handles stringified JSON & DynamoDB formats)
//   const parse = (input: any) => {
//       if (!input) return null;
//       let data = input;
//       if (typeof data === 'string') {
//           try { data = JSON.parse(data); } catch (e) { return null; }
//       }
//       if (data && data.M) data = data.M; // Unwrap DynamoDB if needed

//       // Helper to extract numbers safely
//       const extract = (v: any) => (v && v.N ? parseFloat(v.N) : parseFloat(v));
      
//       // Attempt to extract location
//       const lat = extract(data.latitude || data.lat);
//       const lng = extract(data.longitude || data.lng || data.long);

//       // Return object with cleaned location AND original properties (like capacity)
//       if (!isNaN(lat) && !isNaN(lng)) {
//           return { ...data, latitude: lat, longitude: lng }; 
//       }
//       return Array.isArray(data) ? data : data;
//   };

//   // ✅ FIX 1: Return 'undefined' instead of 'null' to satisfy AWS SDK types
//   const getPos = (loc: any): number[] | undefined => 
//       (loc && !isNaN(loc.longitude) && !isNaN(loc.latitude)) 
//       ? [loc.longitude, loc.latitude] 
//       : undefined;

//   // 2. Parse Inputs
//   const orders = parse(event.arguments.orders) || [];
//   let rawAgents = parse(event.arguments.agents) || [];
//   if (!Array.isArray(rawAgents)) rawAgents = [];
  
//   const defaultRepo = parse(event.arguments.restaurantLocation);

//   if (!orders.length) return { proposal: [], routeMetrics: [] };

//   // ====================================================
//   // STEP 1: VALIDATE AGENTS & INIT LOAD TRACKING
//   // ====================================================
  
//   const validAgents: any[] = [];
//   const agentLiveLoad: Record<string, number> = {};

//   rawAgents.forEach((a: any) => {
//       // 1. Parse Location (Must be valid)
//       const loc = parse(a.location);
      
//       // ✅ FIX 2: Check if getPos returns a real array
//       if (getPos(loc)) {
//           validAgents.push({ ...a, location: loc });
          
//           // 2. Initialize Load Tracking
//           const id = a.id || a.sk;
//           // Use 'currentLoad' passed from Frontend, or default to 0
//           const currentLoad = a.currentLoad ? parseInt(a.currentLoad) : 0;
//           agentLiveLoad[id] = isNaN(currentLoad) ? 0 : currentLoad;
//       }
//   });
  
//   if (validAgents.length === 0) {
//       console.log("⚠️ No agents have valid locations.");
//       return { proposal: [], routeMetrics: [] };
//   }

//   try {
//       // ====================================================
//       // STEP 2: CALL AWS MATRIX (Get Distances)
//       // ====================================================
      
//       // ✅ FIX 3: Force type casting or ensure no nulls
//       // Since validAgents IS filtered, we force 'as number[]' to silence the error
//       const origins = validAgents.map((a: any) => ({ 
//           Position: getPos(a.location) as number[] 
//       }));
      
//       const destinations = orders.map((o: any) => {
//           const pos = getPos(parse(o.restaurantLocation)) || getPos(parse(o.pickupLocation)) || getPos(defaultRepo);
//           // SDK expects [0,0] rather than null/undefined for strict Position types in destinations
//           return { Position: pos || [0, 0] };
//       });

//       const command = new CalculateRouteMatrixCommand({
//           Origins: origins,
//           Destinations: destinations,
//           TravelMode: "Car",
//           RoutingBoundary: { Unbounded: true }
//       });

//       const response = await client.send(command);
//       const matrix = response.RouteMatrix || []; // matrix[agentIndex][orderIndex]


//       // ====================================================
//       // STEP 3: ASSIGN ORDERS (With Capacity Logic)
//       // ====================================================
//       const proposalMap: Record<string, string[]> = {};
//       const metricsMap: Record<string, any> = {}; 

//       // Initialize proposal lists for all agents
//       validAgents.forEach((a: any) => {
//           const id = a.id || a.sk;
//           if (id) proposalMap[id] = [];
//       });

//       orders.forEach((order: any, orderIdx: number) => {
//           const orderCost = getOrderLoad(order);
          
//           let bestAgentId: string | null = null;
//           let minDuration = Number.MAX_SAFE_INTEGER;
//           let bestMetric = { distance: 0, duration: 0 };

//           // --- FIND BEST AGENT ---
//           validAgents.forEach((agent: any, agentIdx: number) => {
//               const agentId = agent.id || agent.sk;

//               // 🚨 CAPACITY CHECK 🚨
//               // 1. Get Agent's Max Capacity (from DB or Default)
//               const agentMax = agent.maxCapacity ? parseInt(agent.maxCapacity) : DEFAULT_MAX_CAPACITY;
              
//               // 2. Check if adding this order overflows the agent
//               if ((agentLiveLoad[agentId] + orderCost) > agentMax) {
//                   return; // Skip this agent, they are full!
//               }

//               // 3. Check Duration (Standard Logic)
//               const route = matrix[agentIdx]?.[orderIdx];
              
//               // TypeScript Safety check
//               if (route && typeof route.Duration === 'number' && typeof route.Distance === 'number') {
//                   if (route.Duration < minDuration) {
//                       minDuration = route.Duration;
//                       bestAgentId = agentId;
//                       bestMetric = {
//                           distance: route.Distance,
//                           duration: route.Duration
//                       };
//                   }
//               }
//           });

//           // --- FINALIZE ASSIGNMENT ---
//           if (bestAgentId) {
//               // 1. Assign Order
//               if (!proposalMap[bestAgentId]) proposalMap[bestAgentId] = [];
//               proposalMap[bestAgentId].push(order.sk);
              
//               // 2. Save Metrics
//               metricsMap[order.sk] = {
//                   orderId: order.sk,
//                   distanceKm: (bestMetric.distance / 1000).toFixed(1),
//                   durationSeconds: bestMetric.duration
//               };

//               // 3. UPDATE LIVE LOAD 🚨
//               // Increment so the next order loop knows this agent is fuller
//               agentLiveLoad[bestAgentId] += orderCost;

//           } else {
//               console.warn(`Order ${order.sk} could not be assigned (All agents full or unreachable).`);
//               metricsMap[order.sk] = { orderId: order.sk, distanceKm: "0.0", durationSeconds: 0 };
//           }
//       });

//       // 4. Return Results
//       const proposal = Object.entries(proposalMap).map(([id, ords]) => ({ agentId: id, assignedOrders: ords }));
//       const routeMetrics = Object.values(metricsMap);

//       return { proposal, routeMetrics };

//   } catch (e) {
//       console.error("Optimization Failed:", e);
//       return { proposal: [], routeMetrics: [] };
//   }
// };


import { GeoRoutesClient, CalculateRouteMatrixCommand } from "@aws-sdk/client-geo-routes";

const client = new GeoRoutesClient({ region: "us-east-1" });
const DEFAULT_MAX_CAPACITY = 10;


const getOrderLoad = (order: any): number => {
  const size = order.size || 'REGULAR';
  switch (size.toString().toUpperCase()) {
      case 'BIG': return 4;
      case 'MEDIUM': return 2;
      default: return 1;
  }
};

export const handler = async (event: any) => {
  // --- PARSING HELPERS ---
  const parse = (input: any) => {
      if (!input) return null;
      let data = typeof input === 'string' ? JSON.parse(input) : input;
      if (data && data.M) data = data.M;
      const extract = (v: any) => (v && v.N ? parseFloat(v.N) : parseFloat(v));
      const lat = extract(data.latitude || data.lat);
      const lng = extract(data.longitude || data.lng || data.long);
      return (!isNaN(lat) && !isNaN(lng)) ? { ...data, latitude: lat, longitude: lng } : data;
  };

  const getPos = (loc: any): number[] | undefined => 
      (loc && !isNaN(loc.longitude) && !isNaN(loc.latitude)) ? [loc.longitude, loc.latitude] : undefined;

  // --- INPUTS ---
  const orders = parse(event.arguments.orders) || [];
  const rawAgents = parse(event.arguments.agents) || [];
  const defaultRepo = parse(event.arguments.restaurantLocation);

  if (!orders.length || !rawAgents.length) return { proposal: [], routeMetrics: [] };

  // --- STEP 1: PREPARE AGENTS & PREDICTIVE TIMING ---
  // Filter out agents with invalid locations
  const validAgents = rawAgents.filter((a: any) => getPos(parse(a.location)));
  
  // Maps to track dynamic status
  const agentLiveLoad: Record<string, number> = {};
  const agentReadyInSeconds: Record<string, number> = {};

  validAgents.forEach((a: any) => {
      const id = a.id || a.sk;
      // 1. Current Load: Sent from frontend (database)
      agentLiveLoad[id] = a.currentLoad ? parseInt(a.currentLoad) : 0;
      
      // 2. Predictive Availability: If agent is delivering, how many seconds left?
      // Sent from frontend (calculated from live tracking)
      agentReadyInSeconds[id] = a.deliveryDurationRemaining ? parseInt(a.deliveryDurationRemaining) : 0;
  });

  try {
      // --- STEP 2: CALCULATE ROUTE MATRIX ---
      const origins = validAgents.map((a: any) => ({ 
          Position: getPos(parse(a.location)) as number[] 
      }));
      
      const destinations = orders.map((o: any) => {
          const pos = getPos(parse(o.restaurantLocation)) || getPos(parse(o.pickupLocation)) || getPos(defaultRepo);
          return { Position: pos || [0, 0] };
      });

      // ✅ FIX: "RoutingBoundary" is REQUIRED by the SDK
      const command = new CalculateRouteMatrixCommand({
          Origins: origins,
          Destinations: destinations,
          TravelMode: "Car",
          RoutingBoundary: { Unbounded: true } // <--- This fixes your red error
      });

      const response = await client.send(command);
      const matrix = response.RouteMatrix || [];

      // --- STEP 3: ASSIGNMENT LOGIC ---
      const proposalMap: Record<string, string[]> = {};
      const metricsMap: Record<string, any> = {}; 

      validAgents.forEach((a: any) => { proposalMap[a.id || a.sk] = []; });

      orders.forEach((order: any, orderIdx: number) => {
          const orderCost = getOrderLoad(order);
          
          let bestAgentId: string | null = null;
          let minTotalTime = Number.MAX_SAFE_INTEGER;
          let bestMetric = { distance: 0, duration: 0 };

          validAgents.forEach((agent: any, agentIdx: number) => {
              const agentId = agent.id || agent.sk;
              const agentMax = agent.maxCapacity ? parseInt(agent.maxCapacity) : DEFAULT_MAX_CAPACITY;

              // 🚫 RULE 1: STRICT CAPACITY CHECK
              // If taking this order exceeds their max limit, skip them.
              if ((agentLiveLoad[agentId] + orderCost) > agentMax) return;

              const route = matrix[agentIdx]?.[orderIdx];
              
              if (route && typeof route.Duration === 'number') {
                  // 🧠 RULE 2: PREDICTIVE AVAILABILITY
                  // Total Cost = (Time until free) + (Drive time to Restaurant)
                  const totalTimeNeeded = agentReadyInSeconds[agentId] + route.Duration;

                  if (totalTimeNeeded < minTotalTime) {
                      minTotalTime = totalTimeNeeded;
                      bestAgentId = agentId;
                      bestMetric = { distance: route.Distance || 0, duration: route.Duration };
                  }
              }
          });

          if (bestAgentId) {
              // Assign the order
              proposalMap[bestAgentId].push(order.sk);
              
              // Store metrics for frontend map
              metricsMap[order.sk] = {
                  orderId: order.sk,
                  distanceKm: (bestMetric.distance / 1000).toFixed(1),
                  durationSeconds: bestMetric.duration
              };

              // UPDATE STATE: Agent is now "fuller" and "busier"
              agentLiveLoad[bestAgentId] += orderCost;
              // If they were free (0), they are now busy for the trip duration.
              // If they were busy (500s), they are now busy for 500s + trip duration.
              // (Note: This simple logic assumes sequential trips)
              agentReadyInSeconds[bestAgentId] += bestMetric.duration;
          }
      });

      return { 
          proposal: Object.entries(proposalMap).map(([id, ords]) => ({ agentId: id, assignedOrders: ords })), 
          routeMetrics: Object.values(metricsMap) 
      };

  } catch (e) {
      console.error("Optimization Failed:", e);
      return { proposal: [], routeMetrics: [] };
  }
};
