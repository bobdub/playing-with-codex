(function () {
  const storageKey = 'imagination-network-prompts';
  const promptForm = document.getElementById('prompt-form');
  const promptInput = document.getElementById('prompt-input');
  const promptTagInput = document.getElementById('prompt-tag');
  const promptIntensity = document.getElementById('prompt-intensity');
  const promptList = document.getElementById('prompt-list');
  const promptTotal = document.getElementById('prompt-total');
  const nodeCount = document.getElementById('node-count');
  const searchInput = document.getElementById('search-input');
  const topicList = document.getElementById('topic-list');
  const knowledgeHighlight = document.getElementById('knowledge-highlight');
  const terminalLog = document.getElementById('terminal-log');
  const terminalForm = document.getElementById('terminal-form');
  const terminalInput = document.getElementById('terminal-input');
  const pulseMetric = document.getElementById('metric-pulses');
  const nodeMetric = document.getElementById('metric-nodes');
  const latestPulse = document.getElementById('latest-pulse');
  const heroPromptForm = document.getElementById('hero-prompt-form');
  const heroPromptInput = document.getElementById('hero-prompt-input');
  const heroPromptButton = heroPromptForm ? heroPromptForm.querySelector('button[type="submit"]') : null;
  const heroResponseContainer = document.getElementById('hero-response');
  const heroResponseText = document.getElementById('hero-response-text');

  const globalCoderConfig =
    typeof window !== 'undefined' && window.CODER_CONFIG
      ? window.CODER_CONFIG
      : typeof window !== 'undefined' && window.KWAIPILOT_CONFIG
        ? window.KWAIPILOT_CONFIG
        : null;
  const globalCoderBase =
    (globalCoderConfig && typeof globalCoderConfig.baseUrl === 'string' && globalCoderConfig.baseUrl) ||
    (typeof window !== 'undefined' && typeof window.CODER_BASE_URL === 'string'
      ? window.CODER_BASE_URL
      : typeof window !== 'undefined' && typeof window.KWAIPILOT_BASE_URL === 'string'
        ? window.KWAIPILOT_BASE_URL
        : undefined);
  const configChatEndpoint =
    globalCoderConfig && typeof globalCoderConfig.chatEndpoint === 'string'
      ? globalCoderConfig.chatEndpoint
      : undefined;
  const configHealthEndpoint =
    globalCoderConfig && typeof globalCoderConfig.healthEndpoint === 'string'
      ? globalCoderConfig.healthEndpoint
      : undefined;

  function parsePositiveInt(value) {
    if (!value && value !== 0) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  function parseTemperature(value) {
    if (!value && value !== 0) return undefined;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 2 ? parsed : undefined;
  }

  function joinUrl(base, path) {
    if (!base) return path;
    const normalisedBase = base.replace(/\/$/, '');
    const normalisedPath = path.replace(/^\//, '');
    return `${normalisedBase}/${normalisedPath}`;
  }

  function resolveEndpoint(base, explicit, fallbackPath) {
    const trimmedBase = typeof base === 'string' ? base.trim() : '';
    const normalisedBase = trimmedBase.replace(/\/+$/, '');
    const trimmedExplicit = typeof explicit === 'string' ? explicit.trim() : '';
    const fallback = trimmedBase ? joinUrl(trimmedBase, fallbackPath) : fallbackPath;

    if (trimmedExplicit) {
      const normalisedExplicit = trimmedExplicit.replace(/\/+$/, '');
      if (normalisedBase && normalisedExplicit === normalisedBase) {
        return joinUrl(trimmedBase, fallbackPath);
      }

      const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmedExplicit);
      const isRootRelative = trimmedExplicit.startsWith('/');
      if (!hasProtocol && !isRootRelative) {
        const relativeBase = trimmedBase || '/';
        return joinUrl(relativeBase, trimmedExplicit);
      }

      return trimmedExplicit;
    }

    return fallback;
  }

  function normaliseError(error) {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error instanceof Error && error.message) return error.message;
    try {
      return JSON.stringify(error);
    } catch (serializationError) {
      return String(error);
    }
  }

  function truncateText(text, limit) {
    if (typeof text !== 'string') return '';
    const boundary = typeof limit === 'number' && limit > 0 ? limit : 360;
    return text.length <= boundary ? text : `${text.slice(0, boundary)}…`;
  }

  const defaultChatPath = '/chat';
  const defaultHealthPath = '/health';

  function ensureEndpointPath(endpoint, fallbackPath) {
    if (!endpoint || !fallbackPath) return endpoint;
    const trimmedEndpoint = endpoint.trim();
    if (!trimmedEndpoint || trimmedEndpoint.includes('?') || trimmedEndpoint.includes('#')) {
      return trimmedEndpoint;
    }
    const trimmedFallback = fallbackPath.trim();
    if (!trimmedFallback) return trimmedEndpoint;
    const normalisedEndpoint = trimmedEndpoint.replace(/\/+$/, '');
    const normalisedFallback = trimmedFallback.replace(/^\/+/, '');
    if (!normalisedFallback) return trimmedEndpoint;
    const lowerEndpoint = normalisedEndpoint.toLowerCase();
    const lowerFallback = normalisedFallback.toLowerCase();
    if (lowerEndpoint.endsWith(`/${lowerFallback}`) || lowerEndpoint === lowerFallback) {
      return normalisedEndpoint === trimmedEndpoint ? trimmedEndpoint : normalisedEndpoint;
    }
    return `${normalisedEndpoint}/${normalisedFallback}`;
  }

  function extractGatewayBase(endpoint, fallbackPath) {
    if (!endpoint || !fallbackPath) return null;
    const trimmedEndpoint = endpoint.trim();
    const trimmedFallback = fallbackPath.trim();
    if (!trimmedEndpoint || !trimmedFallback) return null;
    if (trimmedEndpoint.includes('?') || trimmedEndpoint.includes('#')) return null;
    const normalisedEndpoint = trimmedEndpoint.replace(/\/+$/, '');
    const normalisedFallback = trimmedFallback.replace(/^\/+/, '');
    if (!normalisedFallback) return null;
    const lowerEndpoint = normalisedEndpoint.toLowerCase();
    const lowerFallback = normalisedFallback.toLowerCase();
    const suffix = `/${lowerFallback}`;
    if (lowerEndpoint.endsWith(suffix)) {
      const base = normalisedEndpoint.slice(0, normalisedEndpoint.length - suffix.length);
      return base ? base : null;
    }
    if (lowerEndpoint === lowerFallback) {
      return null;
    }
    return null;
  }

  function inferGatewayBase(chatEndpoint, healthEndpoint) {
    const chatBase = extractGatewayBase(chatEndpoint, defaultChatPath);
    const healthBase = extractGatewayBase(healthEndpoint, defaultHealthPath);
    if (chatBase && healthBase) {
      return chatBase === healthBase ? chatBase : chatBase.length >= healthBase.length ? chatBase : healthBase;
    }
    return chatBase || healthBase || null;
  }

  function buildAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const auth = coderBridge.auth;
    if (!auth || !auth.token || !auth.header || typeof auth.header !== 'string') {
      return headers;
    }
    let tokenValue = typeof auth.token === 'string' ? auth.token : String(auth.token);
    if (auth.header.toLowerCase() === 'authorization') {
      const scheme = (auth.scheme || 'Bearer').trim();
      const lowerToken = tokenValue.toLowerCase();
      const lowerScheme = scheme.toLowerCase();
      if (!lowerToken.startsWith(`${lowerScheme} `)) {
        tokenValue = `${scheme} ${tokenValue}`;
      }
    }
    headers[auth.header] = tokenValue;
    return headers;
  }

  function normaliseOpenAIMessageContent(content) {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object') {
            if (typeof part.text === 'string') return part.text;
            if (typeof part.content === 'string') return part.content;
          }
          return '';
        })
        .join('');
    }
    if (content && typeof content === 'object') {
      if (typeof content.text === 'string') return content.text;
      if (typeof content.content === 'string') return content.content;
    }
    return '';
  }

  function normaliseChatCompletionPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    if (typeof payload.response === 'string') {
      const trimmed = payload.response.trim();
      const tokens = typeof payload.tokens_generated === 'number' ? payload.tokens_generated : null;
      const modelName = typeof payload.model === 'string' ? payload.model : null;
      return { completion: trimmed, tokens, model: modelName };
    }
    if (Array.isArray(payload.choices)) {
      const choice =
        payload.choices.find((item) => item && item.message && item.message.role === 'assistant') ||
        payload.choices.find((item) => item && item.delta) ||
        payload.choices[0];
      if (!choice) {
        return { completion: '', tokens: null, model: null };
      }
      const usage = payload.usage && typeof payload.usage === 'object' ? payload.usage : null;
      const completionTokens =
        usage && typeof usage.completion_tokens === 'number'
          ? usage.completion_tokens
          : usage && typeof usage.total_tokens === 'number'
            ? usage.total_tokens
            : null;
      const modelName = typeof payload.model === 'string' ? payload.model : null;
      if (choice.message) {
        const message = choice.message;
        const content = normaliseOpenAIMessageContent(message.content);
        return { completion: content.trim(), tokens: completionTokens, model: modelName };
      }
      if (typeof choice.text === 'string') {
        return { completion: choice.text.trim(), tokens: completionTokens, model: modelName };
      }
    }
    return null;
  }

  function buildResponseObject(payload, source) {
    const normalised = normaliseChatCompletionPayload(payload);
    if (normalised) {
      return {
        response: normalised.completion,
        tokens_generated:
          normalised.tokens ?? (typeof payload.tokens_generated === 'number' ? payload.tokens_generated : null),
        model: normalised.model ?? (typeof payload.model === 'string' ? payload.model : undefined),
        raw: payload,
        source,
      };
    }
    if (payload && typeof payload.response === 'string') {
      return {
        response: payload.response.trim(),
        tokens_generated:
          typeof payload.tokens_generated === 'number' ? payload.tokens_generated : null,
        model: typeof payload.model === 'string' ? payload.model : undefined,
        raw: payload,
        source,
      };
    }
    if (payload && typeof payload === 'object') {
      let serialised = '';
      try {
        serialised = JSON.stringify(payload);
      } catch (serializationError) {
        serialised = String(payload);
      }
      return { response: serialised, tokens_generated: null, raw: payload, source };
    }
    return { response: String(payload ?? ''), tokens_generated: null, raw: payload, source };
  }

  function resolveOpenAIChatEndpoint() {
    if (coderBridge.openAI && coderBridge.openAI.chatCompletionsEndpoint) {
      return coderBridge.openAI.chatCompletionsEndpoint;
    }
    const chatEndpoint = coderBridge.endpoints.chat;
    const healthEndpoint = coderBridge.endpoints.health;
    if (chatEndpoint && /\/v1\/chat\/completions/i.test(chatEndpoint)) {
      return chatEndpoint;
    }
    const base = inferGatewayBase(chatEndpoint, healthEndpoint);
    if (base) {
      return joinUrl(base, '/v1/chat/completions');
    }
    if (chatEndpoint && /\/chat(?:\/)?$/i.test(chatEndpoint)) {
      return chatEndpoint.replace(/\/chat(?:\/)?$/i, '/v1/chat/completions');
    }
    if (chatEndpoint) {
      const trimmed = chatEndpoint.replace(/\/+$/, '');
      if (trimmed) {
        const suffix = /\/v\d+$/i.test(trimmed) ? 'chat/completions' : 'v1/chat/completions';
        return joinUrl(trimmed, suffix);
      }
    }
    return null;
  }

  async function postJson(url, payload, headers) {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const errorPayload = await response.json();
        if (errorPayload) {
          if (typeof errorPayload.detail === 'string') {
            detail = errorPayload.detail;
          } else if (typeof errorPayload.error === 'string') {
            detail = errorPayload.error;
          } else if (
            errorPayload.error &&
            typeof errorPayload.error === 'object' &&
            typeof errorPayload.error.message === 'string'
          ) {
            detail = errorPayload.error.message;
          }
        }
      } catch (jsonError) {
        try {
          const text = await response.text();
          if (text) {
            detail = text;
          }
        } catch (textError) {
          // Ignore secondary parsing issues
        }
      }

      const httpError = new Error(detail);
      httpError.status = response.status;
      httpError.url = url;
      throw httpError;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const parsed = await response.json();
      return { payload: parsed, response };
    }
    const text = await response.text();
    return { payload: { response: text, tokens_generated: null }, response };
  }

  const datasetProvider = heroPromptForm && heroPromptForm.dataset.llmProvider;
  const configProvider =
    globalCoderConfig && typeof globalCoderConfig.provider === 'string' ? globalCoderConfig.provider : null;
  const providerSlug = (datasetProvider || configProvider || 'qwen').toLowerCase();
  const datasetProviderLabel = heroPromptForm && heroPromptForm.dataset.llmLabel;
  const configProviderLabel =
    globalCoderConfig && typeof globalCoderConfig.label === 'string' ? globalCoderConfig.label : undefined;
  const providerFallbackLabel =
    providerSlug === 'openai'
      ? 'OpenAI Chat'
      : providerSlug === 'anthropic'
        ? 'Claude'
        : providerSlug === 'mistral'
          ? 'Mistral'
          : 'Qwen2.5 Coder';
  const providerLabel = datasetProviderLabel || configProviderLabel || providerFallbackLabel;
  const datasetProviderShortLabel = heroPromptForm && heroPromptForm.dataset.llmShortLabel;
  const configProviderShortLabel =
    globalCoderConfig && typeof globalCoderConfig.shortLabel === 'string' ? globalCoderConfig.shortLabel : undefined;
  const providerShortLabel =
    datasetProviderShortLabel ||
    configProviderShortLabel ||
    (providerLabel && providerLabel.split(/\s+/)[0] ? providerLabel.split(/\s+/)[0] : providerSlug.toUpperCase());

  const datasetModel = heroPromptForm && heroPromptForm.dataset.llmModel;
  const configModel = globalCoderConfig && typeof globalCoderConfig.model === 'string' ? globalCoderConfig.model : undefined;
  const datasetSystemPrompt = heroPromptForm && heroPromptForm.dataset.llmSystemPrompt;
  const configSystemPrompt =
    globalCoderConfig && typeof globalCoderConfig.systemPrompt === 'string' ? globalCoderConfig.systemPrompt : undefined;
  const datasetApiKey = heroPromptForm && heroPromptForm.dataset.llmApiKey;
  const configApiKey =
    globalCoderConfig && typeof globalCoderConfig.apiKey === 'string' ? globalCoderConfig.apiKey : undefined;
  const windowApiKey =
    typeof window !== 'undefined' && typeof window.CODER_API_KEY === 'string' ? window.CODER_API_KEY : undefined;
  const datasetAuthHeader = heroPromptForm && heroPromptForm.dataset.llmAuthHeader;
  const configAuthHeader =
    globalCoderConfig && typeof globalCoderConfig.authHeader === 'string' ? globalCoderConfig.authHeader : undefined;
  const datasetAuthScheme = heroPromptForm && heroPromptForm.dataset.llmAuthScheme;
  const configAuthScheme =
    globalCoderConfig && typeof globalCoderConfig.authScheme === 'string' ? globalCoderConfig.authScheme : undefined;
  const datasetChatCompletionsEndpoint = heroPromptForm && heroPromptForm.dataset.llmChatCompletions;
  const configChatCompletionsEndpoint =
    globalCoderConfig && typeof globalCoderConfig.chatCompletionsEndpoint === 'string'
      ? globalCoderConfig.chatCompletionsEndpoint
      : undefined;

  const datasetBase = heroPromptForm && heroPromptForm.dataset.llmBase;
  const fallbackBaseUrl = '/api/qwen';
  const coderBase = datasetBase || globalCoderBase || fallbackBaseUrl;
  const datasetChatEndpoint = heroPromptForm && heroPromptForm.dataset.llmEndpoint;
  const datasetHealthEndpoint = heroPromptForm && heroPromptForm.dataset.llmHealthEndpoint;
  const datasetMaxTokens = heroPromptForm && parsePositiveInt(heroPromptForm.dataset.llmMaxTokens);
  const configMaxTokens = globalCoderConfig && parsePositiveInt(globalCoderConfig.maxNewTokens);
  const datasetTemperature = heroPromptForm && parseTemperature(heroPromptForm.dataset.llmTemperature);
  const configTemperature = globalCoderConfig && parseTemperature(globalCoderConfig.temperature);
  const usingDefaultGateway =
    !datasetChatEndpoint &&
    !datasetHealthEndpoint &&
    !configChatEndpoint &&
    !configHealthEndpoint &&
    !datasetBase &&
    !globalCoderBase;

  const rawChatEndpoint = datasetChatEndpoint || configChatEndpoint;
  const rawHealthEndpoint = datasetHealthEndpoint || configHealthEndpoint;

  const authHeader =
    datasetAuthHeader ||
    configAuthHeader ||
    (datasetApiKey || configApiKey || windowApiKey ? 'Authorization' : undefined);
  let authScheme = datasetAuthScheme || configAuthScheme || null;
  if (!authScheme && authHeader && authHeader.toLowerCase() === 'authorization') {
    authScheme = 'Bearer';
  }

  const chatCompletionsOverride = datasetChatCompletionsEndpoint || configChatCompletionsEndpoint || null;
  const resolvedApiKey = datasetApiKey || configApiKey || windowApiKey || null;

  const coderBridge = {
    provider: providerSlug,
    label: providerLabel,
    shortLabel: providerShortLabel,
    status: 'calibrating',
    phase: 'interface-foundations',
    endpoints: {
      chat: resolveEndpoint(coderBase, rawChatEndpoint, defaultChatPath),
      health: resolveEndpoint(coderBase, rawHealthEndpoint, defaultHealthPath),
    },
    defaults: {
      maxNewTokens: datasetMaxTokens ?? configMaxTokens ?? 1024,
      temperature: datasetTemperature ?? configTemperature ?? 0.2,
      model: datasetModel || configModel || null,
    },
    auth: {
      header: authHeader || null,
      scheme: authScheme,
      token: resolvedApiKey,
    },
    openAI: {
      systemPrompt: datasetSystemPrompt || configSystemPrompt || '',
      model: datasetModel || configModel || null,
      chatCompletionsEndpoint: chatCompletionsOverride,
    },
  };

  function buildCoderCandidates() {
    const candidates = [];
    const seen = new Set();

    function addCandidate(chat, health) {
      if (!chat || !health) {
        return;
      }
      const key = `${chat}::${health}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      candidates.push({ chat, health });
    }

    const initial = {
      chat: coderBridge.endpoints.chat,
      health: coderBridge.endpoints.health,
    };

    addCandidate(initial.chat, initial.health);

    const inferredBase = inferGatewayBase(initial.chat, initial.health);
    if (inferredBase) {
      addCandidate(joinUrl(inferredBase, defaultChatPath), joinUrl(inferredBase, defaultHealthPath));
    }

    const heuristic = {
      chat: ensureEndpointPath(initial.chat, defaultChatPath),
      health: ensureEndpointPath(initial.health, defaultHealthPath),
    };
    if (heuristic.chat !== initial.chat || heuristic.health !== initial.health) {
      addCandidate(heuristic.chat, heuristic.health);
    }

    if (usingDefaultGateway) {
      const directBases = ['http://127.0.0.1:8080', 'http://localhost:8080'];
      if (typeof window !== 'undefined' && window.location && window.location.hostname) {
        directBases.push(`http://${window.location.hostname}:8080`);
      }
      for (const base of directBases) {
        addCandidate(joinUrl(base, defaultChatPath), joinUrl(base, defaultHealthPath));
      }
    }

    return candidates;
  }

  async function probeCoderCandidate(candidate) {
    if (!candidate || !candidate.health || !candidate.chat) {
      return { ok: false, payload: null };
    }

    try {
      const response = await fetch(candidate.health, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        return { ok: false, payload: null };
      }
      let payload = {};
      try {
        payload = await response.json();
      } catch (parseError) {
        payload = {};
      }
      return { ok: true, payload };
    } catch (error) {
      return { ok: false, payload: null };
    }
  }

  async function autoConfigureCoderEndpoints() {
    const previousChat = coderBridge.endpoints.chat;
    const previousHealth = coderBridge.endpoints.health;
    const candidates = buildCoderCandidates();

    for (const candidate of candidates) {
      const probe = await probeCoderCandidate(candidate);
      if (probe.ok) {
        coderBridge.endpoints.chat = candidate.chat;
        coderBridge.endpoints.health = candidate.health;
        const changed = candidate.chat !== previousChat || candidate.health !== previousHealth;
        if (changed) {
          logToTerminal(`${providerShortLabel} endpoint updated to ${candidate.chat}`, 'system');
        }
        return { configured: true, changed, payload: probe.payload };
      }
    }

    return { configured: Boolean(previousChat), changed: false, payload: null };
  }

  function updateHeroStatus(status, message) {
    coderBridge.status = status;
    if (heroResponseContainer) {
      heroResponseContainer.dataset.status = status;
      heroResponseContainer.dataset.provider = coderBridge.provider;
    }
    if (heroResponseText) {
      heroResponseText.dataset.status = status;
      heroResponseText.dataset.provider = coderBridge.provider;
      heroResponseText.textContent = message;
    }
  }

  function setHeroPromptBusy(isBusy) {
    if (heroPromptForm) {
      heroPromptForm.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    }
    if (heroPromptInput) {
      heroPromptInput.disabled = Boolean(isBusy);
    }
    if (heroPromptButton) {
      heroPromptButton.disabled = Boolean(isBusy);
      heroPromptButton.setAttribute('aria-disabled', isBusy ? 'true' : 'false');
    }
  }

  /** @type {{id: string; file: string; occurrences: number; preview: string; symbolPath: string[]}[]} */
  let topics = [];
  let totalTopics = 0;
  /** @type {{prompt: string; tag: string; intensity: string; timestamp: string}[]} */
  let prompts = [];

  function loadPrompts() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          prompts = parsed;
        }
      }
    } catch (error) {
      console.warn('Unable to parse stored prompts', error);
    }
    renderPrompts();
  }

  function savePrompts() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(prompts));
    } catch (error) {
      console.warn('Unable to persist prompts', error);
    }
  }

  async function requestCoderResponse(prompt) {
    const headers = buildAuthHeaders();
    const payload = { prompt };
    if (typeof coderBridge.defaults.maxNewTokens === 'number') {
      payload.max_new_tokens = coderBridge.defaults.maxNewTokens;
    }
    if (typeof coderBridge.defaults.temperature === 'number') {
      payload.temperature = coderBridge.defaults.temperature;
    }

    let primaryError = null;
    try {
      const { payload: primaryPayload } = await postJson(coderBridge.endpoints.chat, payload, headers);
      return buildResponseObject(primaryPayload, 'chat');
    } catch (error) {
      primaryError = error;
      const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined;
      if (status === 405) {
        error.message =
          `${providerShortLabel} gateway rejected the request. Configure the reverse proxy to allow POST /chat requests.`;
      } else if (status === 404) {
        error.message = `${providerShortLabel} gateway endpoint not found. Configure the reverse proxy to expose /chat.`;
      }
      if (status !== 404 && status !== 405 && status !== 400 && status !== 422) {
        throw error;
      }
    }

    const chatCompletionsEndpoint = resolveOpenAIChatEndpoint();
    if (!chatCompletionsEndpoint) {
      throw primaryError || new Error('OpenAI-compatible endpoint is not configured.');
    }

    const messages = [];
    if (coderBridge.openAI && coderBridge.openAI.systemPrompt) {
      messages.push({ role: 'system', content: coderBridge.openAI.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const openAiPayload = {
      messages,
      stream: false,
    };
    const inferredModel =
      (coderBridge.openAI && coderBridge.openAI.model) ||
      (coderBridge.defaults && coderBridge.defaults.model);
    if (inferredModel) {
      openAiPayload.model = inferredModel;
    }
    if (typeof coderBridge.defaults.temperature === 'number') {
      openAiPayload.temperature = coderBridge.defaults.temperature;
    }
    if (typeof coderBridge.defaults.maxNewTokens === 'number') {
      openAiPayload.max_tokens = coderBridge.defaults.maxNewTokens;
    }

    try {
      const { payload: fallbackPayload } = await postJson(chatCompletionsEndpoint, openAiPayload, headers);
      return buildResponseObject(fallbackPayload, 'chat-completions');
    } catch (error) {
      if (primaryError) {
        const aggregated = new Error(
          `${providerShortLabel} /chat: ${normaliseError(primaryError)}; OpenAI-compatible fallback: ${normaliseError(error)}`,
        );
        const primaryStatus =
          primaryError && typeof primaryError.status === 'number' ? Number(primaryError.status) : undefined;
        const fallbackStatus = error && typeof error.status === 'number' ? Number(error.status) : undefined;
        aggregated.status =
          primaryStatus && (primaryStatus === 404 || primaryStatus === 405)
            ? primaryStatus
            : fallbackStatus || primaryStatus;
        throw aggregated;
      }
      throw error;
    }
  }

  async function checkCoderHealth(prefetchedPayload) {
    if (!coderBridge.endpoints.health) {
      updateHeroStatus(
        'offline',
        `${providerShortLabel} endpoint is not configured. Configure the gateway to enable live responses.`,
      );
      return;
    }

    if (prefetchedPayload && typeof prefetchedPayload === 'object') {
      const modelName = typeof prefetchedPayload.model === 'string' ? prefetchedPayload.model : providerLabel;
      updateHeroStatus('online', `${modelName} channel ready. Share an intention to receive a reflection.`);
      logToTerminal(`${providerShortLabel} online (${modelName}).`, 'system');
      return;
    }

    updateHeroStatus('checking', `Checking ${providerShortLabel} status…`);
    try {
      const response = await fetch(coderBridge.endpoints.health, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      let payload = {};
      try {
        payload = await response.json();
      } catch (parseError) {
        payload = {};
      }
      const modelName = payload && typeof payload.model === 'string' ? payload.model : providerLabel;
      updateHeroStatus('online', `${modelName} channel ready. Share an intention to receive a reflection.`);
      logToTerminal(`${providerShortLabel} online (${modelName}).`, 'system');
    } catch (error) {
      const reason = normaliseError(error);
      updateHeroStatus(
        'offline',
        `${providerShortLabel} channel is offline. Prompts are stored locally until the agent returns.`,
      );
      logToTerminal(`${providerShortLabel} health check failed: ${reason}`, 'warning');
    }
  }

  async function initializeCoderBridge() {
    if (!heroResponseText) return;
    updateHeroStatus('calibrating', `Calibrating the ${providerShortLabel} channel…`);

    const resolution = await autoConfigureCoderEndpoints();

    if (!coderBridge.endpoints.chat) {
      updateHeroStatus(
        'offline',
        `${providerShortLabel} endpoint is not configured. Configure the gateway to enable live responses.`,
      );
      return;
    }

    await checkCoderHealth(resolution.payload);
  }

  async function handleHeroPromptSubmit(event) {
    if (!heroPromptInput || !heroResponseText) return;
    event.preventDefault();
    const message = heroPromptInput.value.trim();
    if (!message) {
      updateHeroStatus('warning', `Share a prompt so Infinity can calibrate the ${providerShortLabel} channel.`);
      heroPromptInput.focus();
      return;
    }

    if (!coderBridge.endpoints.chat) {
      updateHeroStatus(
        'offline',
        `${providerShortLabel} endpoint is not configured. Configure the gateway to enable live responses.`,
      );
      return;
    }

    setHeroPromptBusy(true);
    updateHeroStatus('sending', `Transmitting intention to ${providerShortLabel}…`);

    let shouldRefocus = false;
    let fallbackModel = null;

    try {
      const payload = await (async () => {
        let lastError;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            return await requestCoderResponse(message);
          } catch (error) {
            lastError = error;
            const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined;
            if (attempt === 0 && (status === 404 || status === 405)) {
              const resolution = await autoConfigureCoderEndpoints();
              if (resolution.changed) {
                if (resolution.payload && typeof resolution.payload.model === 'string') {
                  fallbackModel = resolution.payload.model;
                }
                continue;
              }
            }
            throw error;
          }
        }
        throw lastError;
      })();
      const completion = payload && typeof payload.response === 'string' ? payload.response.trim() : '';
      if (completion) {
        updateHeroStatus('responded', `${providerShortLabel} › ${truncateText(completion, 480)}`);
        logToTerminal(`${providerShortLabel} › ${completion}`, providerSlug);
      } else {
        updateHeroStatus('responded', `${providerShortLabel} responded with an empty message.`);
        logToTerminal(`${providerShortLabel} returned an empty response.`, 'warning');
      }
      if (payload && typeof payload.tokens_generated === 'number') {
        logToTerminal(`Tokens generated: ${payload.tokens_generated}`, 'system');
      }
      if (payload && payload.source === 'chat-completions') {
        logToTerminal(`${providerShortLabel} OpenAI-compatible fallback active.`, 'system');
      }
      const responseModel = payload && typeof payload.model === 'string' ? payload.model : null;
      if (responseModel) {
        logToTerminal(`${providerShortLabel} model confirmed (${responseModel}).`, 'system');
      }
      if (fallbackModel && (!responseModel || fallbackModel !== responseModel)) {
        logToTerminal(`${providerShortLabel} fallback channel confirmed (${fallbackModel}).`, 'system');
      }
      heroPromptInput.value = '';
      shouldRefocus = true;
    } catch (error) {
      const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined;
      const reason = normaliseError(error);
      if (status === 404 || status === 405) {
        updateHeroStatus(
          'offline',
          `${providerShortLabel} gateway is not accepting chat requests. Configure the reverse proxy to forward POST /chat to the agent.`,
        );
        logToTerminal(`${providerShortLabel} gateway refused the request (${reason}).`, 'warning');
      } else {
        updateHeroStatus('error', `${providerShortLabel} request failed: ${reason}`);
        logToTerminal(`${providerShortLabel} request failed: ${reason}`, 'error');
      }
      shouldRefocus = true;
    } finally {
      setHeroPromptBusy(false);
      if (shouldRefocus && heroPromptInput) {
        heroPromptInput.focus();
      }
    }
  }

  function updatePulseMetrics() {
    if (pulseMetric) {
      pulseMetric.textContent = String(prompts.length);
    }
    if (latestPulse) {
      if (prompts.length === 0) {
        latestPulse.textContent = 'No pulses recorded yet. Your first intention will illuminate the terminal log.';
      } else {
        const mostRecent = prompts[prompts.length - 1];
        const tag = mostRecent.tag ? ` #${mostRecent.tag}` : '';
        const timestamp = new Date(mostRecent.timestamp).toLocaleString();
        latestPulse.textContent = `Latest pulse · "${mostRecent.prompt}"${tag} · ${mostRecent.intensity} · ${timestamp}`;
      }
    }
  }

  function renderPrompts() {
    promptList.innerHTML = '';
    if (promptTotal) {
      promptTotal.textContent =
        prompts.length === 0
          ? 'No pulses stored yet.'
          : `${prompts.length} ${prompts.length === 1 ? 'pulse' : 'pulses'} stored locally.`;
    }
    if (prompts.length === 0) {
      const empty = document.createElement('li');
      empty.textContent = 'No pulses recorded yet. Plant a prompt to begin the resonance.';
      promptList.appendChild(empty);
      updatePulseMetrics();
      return;
    }

    for (const entry of prompts.slice(-6).reverse()) {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = entry.prompt;
      item.appendChild(title);

      const meta = document.createElement('span');
      meta.textContent = `${entry.tag ? `#${entry.tag} · ` : ''}${entry.intensity} · ${new Date(entry.timestamp).toLocaleString()}`;
      item.appendChild(meta);
      promptList.appendChild(item);
    }
    updatePulseMetrics();
  }

  function logToTerminal(message, tone = 'system') {
    if (!terminalLog) return;
    const line = document.createElement('p');
    line.className = 'terminal-line';
    line.dataset.tone = tone;
    line.textContent = message;
    terminalLog.appendChild(line);
    terminalLog.scrollTop = terminalLog.scrollHeight;
  }

  function clearTerminal() {
    terminalLog.innerHTML = '';
  }

  function transformTopics(payload) {
    if (!payload || !Array.isArray(payload.symbols)) {
      return [];
    }

    const entries = [];
    for (const symbol of payload.symbols) {
      if (!symbol || !Array.isArray(symbol.entries)) continue;
      const topEntry = symbol.entries[0];
      entries.push({
        id: symbol.identifier,
        occurrences: symbol.occurrences ?? symbol.entries.length,
        file: topEntry?.file ?? 'unknown',
        preview: (topEntry?.valuePreview || '').slice(0, 240),
        symbolPath: Array.isArray(topEntry?.path) ? topEntry.path : [],
      });
    }
    entries.sort((a, b) => {
      const occurrenceDelta = (b.occurrences || 0) - (a.occurrences || 0);
      return occurrenceDelta !== 0 ? occurrenceDelta : a.id.localeCompare(b.id);
    });
    return entries;
  }

  function renderTopics(list) {
    topicList.innerHTML = '';
    updateKnowledgeHighlight(list);
    if (!list || list.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'topic-card';
      empty.textContent = 'No dream nodes match the current filters.';
      topicList.appendChild(empty);
      nodeCount.textContent = '0';
      if (nodeMetric) {
        nodeMetric.textContent = String(totalTopics);
      }
      return;
    }

    for (const topic of list) {
      const item = document.createElement('li');
      item.className = 'topic-card';

      const header = document.createElement('div');
      header.className = 'topic-card__header';
      const identifier = document.createElement('div');
      identifier.className = 'topic-card__identifier';
      identifier.textContent = topic.id;
      header.appendChild(identifier);

      const meta = document.createElement('div');
      meta.className = 'topic-card__meta';
      const occurrence = document.createElement('span');
      occurrence.textContent = `${topic.occurrences} pulses`;
      meta.appendChild(occurrence);
      const file = document.createElement('span');
      file.textContent = topic.file;
      meta.appendChild(file);
      header.appendChild(meta);
      item.appendChild(header);

      if (topic.preview) {
        const preview = document.createElement('p');
        preview.className = 'topic-card__preview';
        preview.textContent = topic.preview;
        item.appendChild(preview);
      }

      if (topic.file && topic.symbolPath.length > 0) {
        const link = document.createElement('a');
        link.className = 'topic-card__link';
        const anchor = encodeURIComponent(topic.symbolPath[topic.symbolPath.length - 1] || topic.id);
        link.href = `../${topic.file}#${anchor}`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Open manuscript';
        item.appendChild(link);
      }

      topicList.appendChild(item);
    }

    nodeCount.textContent = String(list.length);
    if (nodeMetric) {
      nodeMetric.textContent = String(totalTopics);
    }
  }

  function updateKnowledgeHighlight(list) {
    if (!knowledgeHighlight) return;
    if (!list || list.length === 0) {
      knowledgeHighlight.textContent = 'No dream nodes match the current filters.';
      return;
    }

    const uniqueFiles = new Set();
    for (const entry of list) {
      if (entry.file) {
        uniqueFiles.add(entry.file);
      }
    }

    const featured = list[0];
    const nodeLabel = list.length === 1 ? 'node' : 'nodes';
    const manuscriptLabel = uniqueFiles.size === 1 ? 'manuscript' : 'manuscripts';
    knowledgeHighlight.textContent = `Showing ${list.length} ${nodeLabel} across ${uniqueFiles.size} ${manuscriptLabel}. Featured: ${
      featured.id
    } (${featured.occurrences} pulses).`;
  }

  function filterTopics(query) {
    const value = query.trim().toLowerCase();
    if (!value) {
      renderTopics(topics);
      return;
    }

    const filtered = topics.filter((topic) => {
      return (
        topic.id.toLowerCase().includes(value) ||
        topic.file.toLowerCase().includes(value) ||
        topic.preview.toLowerCase().includes(value)
      );
    });
    renderTopics(filtered);
  }

  async function loadKnowledgeIndex() {
    try {
      const response = await fetch('../docs/knowledge-index.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      topics = transformTopics(payload);
      totalTopics = topics.length;
      renderTopics(topics);
      if (nodeMetric) {
        nodeMetric.textContent = String(totalTopics);
      }
      logToTerminal(`Loaded ${topics.length} dream nodes from the knowledge index.`);
    } catch (error) {
      logToTerminal(`Unable to load knowledge index: ${(error && error.message) || error}`);
      if (knowledgeHighlight) {
        knowledgeHighlight.textContent = 'Unable to load the knowledge index right now.';
      }
      if (nodeMetric) {
        nodeMetric.textContent = '0';
      }
    }
  }

  function handlePromptSubmit(event) {
    event.preventDefault();
    const prompt = promptInput.value.trim();
    if (!prompt) {
      promptInput.focus();
      return;
    }
    const tag = promptTagInput.value.trim();
    const intensity = promptIntensity.value;
    const entry = {
      prompt,
      tag,
      intensity,
      timestamp: new Date().toISOString(),
    };
    prompts.push(entry);
    savePrompts();
    renderPrompts();
    promptForm.reset();
    promptIntensity.value = 'gentle';
    logToTerminal(`Pulse received: "${prompt}"${tag ? ` #${tag}` : ''} [${intensity}]`, 'pulse');
    promptInput.focus();
  }

  function handleSearch(event) {
    filterTopics(event.target.value || '');
  }

  function executeTerminalCommand(input) {
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    logToTerminal(`› ${trimmed}`, 'input');

    const [command, ...rest] = trimmed.split(/\s+/);
    const argument = rest.join(' ');

    switch (command.toLowerCase()) {
      case 'help':
        logToTerminal('Commands: help · search <term> · open <symbol> · pulse · clear');
        break;
      case 'search':
        if (!argument) {
          logToTerminal('Usage: search <term>');
          break;
        }
        searchInput.value = argument;
        filterTopics(argument);
        logToTerminal(`Search applied for "${argument}".`);
        break;
      case 'open': {
        if (!argument) {
          logToTerminal('Usage: open <symbol>');
          break;
        }
        const symbolId = argument.toLowerCase();
        const match = topics.find((topic) => topic.id.toLowerCase() === symbolId);
        if (match) {
          logToTerminal(`${match.id} · ${match.file} · ${match.preview}`);
        } else {
          logToTerminal(`No symbol found for ${argument}`);
        }
        break;
      }
      case 'pulse': {
        if (prompts.length === 0) {
          logToTerminal('No pulses recorded yet. Send one from the landing portal.');
        } else {
          const latest = prompts[prompts.length - 1];
          logToTerminal(
            `Latest pulse » "${latest.prompt}" ${latest.tag ? `#${latest.tag}` : ''} · ${latest.intensity} · ${new Date(
              latest.timestamp,
            ).toLocaleString()}`,
          );
        }
        break;
      }
      case 'clear':
        clearTerminal();
        break;
      default:
        logToTerminal(`Unknown command: ${command}. Try "help" for a list of actions.`);
        break;
    }
  }

  function handleTerminalSubmit(event) {
    event.preventDefault();
    const value = terminalInput.value;
    executeTerminalCommand(value);
    terminalInput.value = '';
  }

  if (heroPromptForm) {
    heroPromptForm.addEventListener('submit', handleHeroPromptSubmit);
  }

  if (promptForm) {
    promptForm.addEventListener('submit', handlePromptSubmit);
  }
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }
  if (terminalForm) {
    terminalForm.addEventListener('submit', handleTerminalSubmit);
  }

  loadPrompts();
  loadKnowledgeIndex();
  initializeCoderBridge();
  logToTerminal('Neural terminal initialized. Type "help" to see available commands.');
})();
