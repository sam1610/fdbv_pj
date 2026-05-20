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
  const agentLiveLoad: Record<string, number> = {};
  const agentReadyInSeconds: Record<string, number> = {};

  // 🟢 FIX: Allow all agents. If they have no live GPS location, assume they are at the Restaurant.
  const validAgents = rawAgents.map((a: any) => {
      const position = getPos(parse(a.location)) || getPos(defaultRepo);
      return { ...a, Position: position };
  }).filter((a: any) => a.Position); // Failsafe

  validAgents.forEach((a: any) => {
      const id = a.id || a.sk;
      agentLiveLoad[id] = a.currentLoad ? parseInt(a.currentLoad) : 0;
      agentReadyInSeconds[id] = a.deliveryDurationRemaining ? parseInt(a.deliveryDurationRemaining) : 0;
  });

  try {
      // --- STEP 2: CALCULATE ROUTE MATRIX ---
      const origins = validAgents.map((a: any) => ({ Position: a.Position }));
      
      const destinations = orders.map((o: any) => {
          // 🟢 FIX: Route to the CUSTOMER'S location, not the restaurant!
          const pos = getPos(parse(o.location)) || getPos(parse(o.pickupLocation)) || getPos(defaultRepo);
          return { Position: pos };
      });

      const command = new CalculateRouteMatrixCommand({
          Origins: origins,
          Destinations: destinations,
          TravelMode: "Car",
          RoutingBoundary: { Unbounded: true } 
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

              if ((agentLiveLoad[agentId] + orderCost) > agentMax) return;

              const route = matrix[agentIdx]?.[orderIdx];
              
              if (route && typeof route.Duration === 'number') {
                  const totalTimeNeeded = agentReadyInSeconds[agentId] + route.Duration;

                  if (totalTimeNeeded < minTotalTime) {
                      minTotalTime = totalTimeNeeded;
                      bestAgentId = agentId;
                      bestMetric = { distance: route.Distance || 0, duration: route.Duration };
                  }
              }
          });

          if (bestAgentId) {
              proposalMap[bestAgentId].push(order.sk);
              metricsMap[order.sk] = {
                  orderId: order.sk,
                  distanceKm: (bestMetric.distance / 1000).toFixed(1),
                  durationSeconds: bestMetric.duration
              };
              agentLiveLoad[bestAgentId] += orderCost;
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