import { ref, watch } from 'vue';
import { storageGetJSON, storageKey, storageSetJSON } from '../utils/storageKeys';

export type McpServerConfig = {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
};

const MCP_SERVERS_STORAGE_KEY = 'mcp.servers.v1';

const servers = ref<McpServerConfig[]>(storageGetJSON<McpServerConfig[]>(MCP_SERVERS_STORAGE_KEY) ?? []);

watch(
  servers,
  (value) => {
    storageSetJSON(MCP_SERVERS_STORAGE_KEY, value);
  },
  { deep: true },
);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey(MCP_SERVERS_STORAGE_KEY)) {
      servers.value = storageGetJSON<McpServerConfig[]>(MCP_SERVERS_STORAGE_KEY) ?? [];
    }
  });
}

export function useMcpServers() {
  function listServers(): readonly McpServerConfig[] {
    return servers.value;
  }

  function addServer(config: McpServerConfig): void {
    if (!config.name.trim()) throw new Error('Server name is required');
    if (servers.value.some((s) => s.name === config.name)) {
      throw new Error(`Server "${config.name}" already exists`);
    }
    servers.value = [...servers.value, config];
  }

  function removeServer(name: string): void {
    servers.value = servers.value.filter((s) => s.name !== name);
  }

  function updateServer(name: string, patch: Partial<Omit<McpServerConfig, 'name'>>): void {
    const index = servers.value.findIndex((s) => s.name === name);
    if (index === -1) throw new Error(`Server "${name}" not found`);
    const next = [...servers.value];
    next[index] = { ...next[index], ...patch };
    servers.value = next;
  }

  return {
    servers,
    listServers,
    addServer,
    removeServer,
    updateServer,
  };
}
