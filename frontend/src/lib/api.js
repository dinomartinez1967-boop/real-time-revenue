import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 15000 });

export async function fetchState() {
    const { data } = await api.get("/state");
    return data;
}

export async function fetchNetworks() {
    const { data } = await api.get("/networks");
    return data;
}

export async function fetchNiches() {
    const { data } = await api.get("/niches");
    return data;
}

export async function fetchFeed(network) {
    const { data } = await api.get(`/feed/${network}`);
    return data;
}

export async function setNiche(key) {
    const { data } = await api.post("/niche", { key });
    return data;
}

export async function publishPost(network, prompt, useLlm = true) {
    const { data } = await api.post("/agents/publish", {
        network,
        prompt,
        use_llm: useLlm,
    });
    return data;
}

export async function flushSandbox() {
    const { data } = await api.post("/sandbox/flush");
    return data;
}

export async function llmStatus() {
    const { data } = await api.get("/llm/status");
    return data;
}
