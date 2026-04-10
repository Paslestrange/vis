import { ref, type Ref } from 'vue';
import * as opencodeApi from '../utils/opencode';

type ProviderModel = {
  id: string;
  name?: string;
  providerID?: string;
  variants?: Record<string, unknown>;
  limit?: {
    context?: number;
    input?: number;
    output?: number;
  };
  capabilities?: {
    attachment?: boolean;
  };
};

type ProviderInfo = {
  id: string;
  name?: string;
  models?: Record<string, ProviderModel>;
};

type ProviderResponse = {
  providers?: ProviderInfo[];
  default?: Record<string, string>;
};

type AgentInfo = {
  name: string;
  description?: string;
  mode?: string;
  hidden?: boolean;
  color?: string;
  model?: {
    providerID: string;
    modelID: string;
  };
  variant?: string;
};

type CommandInfo = {
  name: string;
  description?: string;
  agent?: string;
  model?: string;
  source?: string;
  template?: string;
  hints?: string[];
};

export function buildThinkingOptions(variants?: Record<string, unknown>) {
  const keys = Object.keys(variants ?? {}).sort();
  return [undefined, ...keys] as Array<string | undefined>;
}

export function buildProviderModelKey(providerID?: string, modelID?: string) {
  const normalizedProvider = providerID?.trim() ?? '';
  const normalizedModel = modelID?.trim() ?? '';
  if (!normalizedProvider || !normalizedModel) return '';
  return `${normalizedProvider}/${normalizedModel}`;
}

export function parseProviderModelKey(value: string) {
  const normalized = value.trim();
  const slashIndex = normalized.indexOf('/');
  if (slashIndex <= 0 || slashIndex >= normalized.length - 1) {
    return { providerID: '', modelID: '' };
  }
  const providerID = normalized.slice(0, slashIndex).trim();
  const modelID = normalized.slice(slashIndex + 1).trim();
  if (!providerID || !modelID) return { providerID: '', modelID: '' };
  return { providerID, modelID };
}

export function useModelOptions() {
  const providers = ref<ProviderInfo[]>([]);
  const agents = ref<AgentInfo[]>([]);
  const commands = ref<CommandInfo[]>([]);
  const modelOptions = ref<
    Array<{
      id: string;
      modelID: string;
      label: string;
      displayName: string;
      providerID?: string;
      providerLabel?: string;
      variants?: Record<string, unknown>;
      attachmentCapable?: boolean;
    }
  >
>([]);
  const agentOptions = ref<Array<{ id: string; label: string; description?: string; color?: string }>>(
    [],
  );
  const thinkingOptions = ref<Array<string | undefined>>([]);
  const providersLoaded = ref(false);
  const providersLoading = ref(false);
  const providersFetchCount = ref(0);
  const agentsLoading = ref(false);
  const commandsLoading = ref(false);
  const selectedModel = ref('');
  const selectedThinking = ref<string | undefined>(undefined);
  const selectedMode = ref('build');

  function applyModelVariantSelection(model: string | undefined, variant: string | undefined) {
    if (modelOptions.value.length === 0) {
      if (model) selectedModel.value = model;
      selectedThinking.value = variant;
      return;
    }

    if (model && modelOptions.value.some((option) => option.id === model)) {
      selectedModel.value = model;
    }

    if (!selectedModel.value && modelOptions.value.length > 0) {
      selectedModel.value = modelOptions.value[0]?.id ?? '';
    }

    const selectedInfo = modelOptions.value.find((option) => option.id === selectedModel.value);
    const nextThinkingOptions = buildThinkingOptions(selectedInfo?.variants);
    const sameThinking =
      nextThinkingOptions.length === thinkingOptions.value.length &&
      nextThinkingOptions.every((value, index) => value === thinkingOptions.value[index]);
    if (!sameThinking) thinkingOptions.value = nextThinkingOptions;

    if (nextThinkingOptions.includes(variant)) {
      selectedThinking.value = variant;
    } else {
      selectedThinking.value = nextThinkingOptions[0];
    }
  }

  function applyAgentDefaults(agentName: string) {
    const agent = agents.value.find((a) => a.name === agentName);
    const defaultModel = agent?.model;
    if (defaultModel?.providerID && defaultModel?.modelID) {
      const match = modelOptions.value.find(
        (m) => m.modelID === defaultModel.modelID && m.providerID === defaultModel.providerID,
      );
      if (match) {
        applyModelVariantSelection(match.id, agent?.variant);
      }
    }
  }

  function resolveDefaultAgentModel(): {
    agent: string;
    model: string;
    variant: string | undefined;
  } {
    const defaultAgent =
      agentOptions.value.find((o) => o.id === 'build')?.id ?? agentOptions.value[0]?.id ?? '';

    selectedMode.value = defaultAgent;
    applyAgentDefaults(defaultAgent);

    if (!selectedModel.value && modelOptions.value.length > 0) {
      const providersData = providers.value;
      const defaults =
        providersData.length > 0 ? ((providersData[0] as any)?.default ?? {}) : {};
      const preferredModelId = Object.entries(defaults)
        .map(([providerID, modelID]) => buildProviderModelKey(providerID, modelID as string))
        .find((value) => Boolean(value));
      const firstModel = modelOptions.value[0]?.id;
      selectedModel.value = preferredModelId || firstModel || '';
    }

    return {
      agent: selectedMode.value,
      model: selectedModel.value,
      variant: selectedThinking.value,
    };
  }

  async function fetchProviders(force = false) {
    if (providersLoading.value || (!force && providersLoaded.value)) return;
    providersLoading.value = true;
    providersFetchCount.value += 1;
    try {
      const data = (await opencodeApi.listProviders()) as ProviderResponse;
      providers.value = Array.isArray(data.providers) ? data.providers : [];
      const models: Array<{
        id: string;
        modelID: string;
        label: string;
        displayName: string;
        providerID?: string;
        providerLabel?: string;
        variants?: Record<string, unknown>;
        attachmentCapable?: boolean;
      }> = [];
      providers.value.forEach((provider) => {
        Object.values(provider.models ?? {}).forEach((model) => {
          const providerID = model.providerID?.trim() || provider.id?.trim() || 'unknown';
          const providerLabel = provider.name?.trim() || providerID;
          const modelDisplayName = model.name?.trim() || model.id;
          const label = `${modelDisplayName} [${providerID}/${model.id}]`;
          const id = buildProviderModelKey(providerID, model.id);
          if (!id) return;
          models.push({
            id,
            modelID: model.id,
            label,
            displayName: modelDisplayName,
            providerID,
            providerLabel,
            variants: model.variants,
            attachmentCapable: model.capabilities?.attachment !== false,
          });
        });
      });
      models.sort((a, b) => {
        const providerA = a.providerLabel ?? a.providerID ?? 'unknown';
        const providerB = b.providerLabel ?? b.providerID ?? 'unknown';
        const providerCompare = providerA.localeCompare(providerB);
        if (providerCompare !== 0) return providerCompare;
        return a.label.localeCompare(b.label);
      });
      const sameModels =
        models.length === modelOptions.value.length &&
        models.every((model, index) => model.id === modelOptions.value[index]?.id);
      if (!sameModels) {
        modelOptions.value = models;
      }

      if (!selectedModel.value) {
        const defaults = data.default ?? {};
        const preferredModelId = Object.entries(defaults)
          .map(([providerID, modelID]) => buildProviderModelKey(providerID, modelID))
          .find((value) => Boolean(value));
        const firstModel = modelOptions.value[0]?.id;
        selectedModel.value = preferredModelId || firstModel || '';
      }
      const selectedInfo = modelOptions.value.find((model) => model.id === selectedModel.value);
      const nextThinkingOptions = buildThinkingOptions(selectedInfo?.variants);
      const sameThinking =
        nextThinkingOptions.length === thinkingOptions.value.length &&
        nextThinkingOptions.every((value, index) => value === thinkingOptions.value[index]);
      if (!sameThinking) thinkingOptions.value = nextThinkingOptions;
      if (
        selectedThinking.value === undefined ||
        !nextThinkingOptions.includes(selectedThinking.value)
      ) {
        selectedThinking.value = thinkingOptions.value[0];
      }
      providersLoaded.value = true;
    } catch {
      // ignore
    } finally {
      providersLoading.value = false;
    }
  }

  async function fetchAgents() {
    if (agentsLoading.value) return;
    agentsLoading.value = true;
    try {
      const data = (await opencodeApi.listAgents()) as AgentInfo[];
      agents.value = Array.isArray(data) ? data : [];
      const options = agents.value
        .filter((agent) => agent.mode === 'primary' || agent.mode === 'all')
        .filter((agent) => !agent.hidden)
        .map((agent) => ({
          id: agent.name,
          label: agent.name
            ? `${agent.name.charAt(0).toUpperCase()}${agent.name.slice(1)}`
            : agent.name,
          description: agent.description,
          color: agent.color,
        }));
      agentOptions.value = options;
      if (!selectedMode.value || !options.some((option) => option.id === selectedMode.value)) {
        const preferred = options.find((option) => option.id === 'build')?.id ?? options[0]?.id;
        if (preferred) {
          selectedMode.value = preferred;
          applyAgentDefaults(preferred);
        }
      }
    } catch {
      // ignore
    } finally {
      agentsLoading.value = false;
    }
  }

  async function fetchCommands(directory?: string) {
    if (commandsLoading.value) return;
    commandsLoading.value = true;
    try {
      const data = (await opencodeApi.listCommands(directory)) as CommandInfo[];
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => a.name.localeCompare(b.name));
      commands.value = list;
    } catch {
      // ignore
    } finally {
      commandsLoading.value = false;
    }
  }

  return {
    providers,
    agents,
    commands,
    modelOptions,
    agentOptions,
    thinkingOptions,
    providersLoaded,
    providersLoading,
    providersFetchCount,
    agentsLoading,
    commandsLoading,
    selectedModel,
    selectedThinking,
    selectedMode,
    applyModelVariantSelection,
    applyAgentDefaults,
    resolveDefaultAgentModel,
    fetchProviders,
    fetchAgents,
    fetchCommands,
  };
}
