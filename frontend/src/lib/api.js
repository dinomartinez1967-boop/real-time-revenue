import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 15000 });

export const fetchState = () => api.get("/state").then((r) => r.data);
export const fetchNetworks = () => api.get("/networks").then((r) => r.data);
export const fetchNiches = () => api.get("/niches").then((r) => r.data);
export const fetchFeed = (n) => api.get(`/feed/${n}`).then((r) => r.data);
export const setNiche = (key) =>
    api.post("/niche", { key }).then((r) => r.data);
export const publishPost = (network, prompt, useLlm = true, provider = "openai") =>
    api.post("/agents/publish", { network, prompt, use_llm: useLlm, provider }).then(
        (r) => r.data,
    );
export const flushSandbox = () => api.post("/sandbox/flush").then((r) => r.data);
export const llmStatus = () => api.get("/llm/status").then((r) => r.data);

// Mode + safety
export const fetchMode = () => api.get("/mode").then((r) => r.data);
export const setMode = (mode) => api.post("/mode", { mode }).then((r) => r.data);
export const armDriver = (driver, on) =>
    api.post("/drivers/arm", { driver, on }).then((r) => r.data);
export const driversStatus = () =>
    api.get("/drivers/status").then((r) => r.data);
export const routeOrder = (payload) =>
    api.post("/drivers/dropdashin/order", payload).then((r) => r.data);
export const publishListing = (payload) =>
    api.post("/drivers/facebook/listing", payload).then((r) => r.data);

// Swarm
export const listAgents = () =>
    api.get("/swarm/agents").then((r) => r.data);
export const spawnAgent = (body) =>
    api.post("/swarm/agents", body).then((r) => r.data);
export const stopAgent = (id) =>
    api.delete(`/swarm/agents/${id}`).then((r) => r.data);
export const stopAllAgents = () =>
    api.post("/swarm/stop_all").then((r) => r.data);

// History
export const fetchHistory = (limit = 200) =>
    api.get(`/analytics/history?limit=${limit}`).then((r) => r.data);
