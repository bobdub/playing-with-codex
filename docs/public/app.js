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

  const globalKwaipilotConfig = typeof window !== 'undefined' && window.KWAIPILOT_CONFIG ? window.KWAIPILOT_CONFIG : null;
  const globalKwaipilotBase =
    (globalKwaipilotConfig && typeof globalKwaipilotConfig.baseUrl === 'string' && globalKwaipilotConfig.baseUrl) ||
    (typeof window !== 'undefined' && typeof window.KWAIPILOT_BASE_URL === 'string' ? window.KWAIPILOT_BASE_URL : undefined);

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

  const datasetBase = heroPromptForm && heroPromptForm.dataset.llmBase;
  const fallbackBaseUrl = '/api/kwaipilot';
  const kwaipilotBase = datasetBase || globalKwaipilotBase || fallbackBaseUrl;
  const datasetChatEndpoint = heroPromptForm && heroPromptForm.dataset.llmEndpoint;
  const datasetHealthEndpoint = heroPromptForm && heroPromptForm.dataset.llmHealthEndpoint;
  const datasetMaxTokens = heroPromptForm && parsePositiveInt(heroPromptForm.dataset.llmMaxTokens);
  const configMaxTokens = globalKwaipilotConfig && parsePositiveInt(globalKwaipilotConfig.maxNewTokens);
  const datasetTemperature = heroPromptForm && parseTemperature(heroPromptForm.dataset.llmTemperature);
  const configTemperature = globalKwaipilotConfig && parseTemperature(globalKwaipilotConfig.temperature);
  const usingDefaultGateway =
    !datasetChatEndpoint &&
    !datasetHealthEndpoint &&
    !datasetBase &&
    !globalKwaipilotBase;

  const kwaipilotBridge = {
    provider: 'kwaipilot',
    status: 'calibrating',
    phase: 'interface-foundations',
    endpoints: {
      chat: datasetChatEndpoint || joinUrl(kwaipilotBase, '/chat'),
      health: datasetHealthEndpoint || joinUrl(kwaipilotBase, '/health'),
    },
    defaults: {
      maxNewTokens: datasetMaxTokens ?? configMaxTokens ?? 512,
      temperature: datasetTemperature ?? configTemperature ?? 0.6,
    },
  };

  function buildKwaipilotCandidates() {
    const candidates = [];
    const seen = new Set();

    const initial = {
      chat: kwaipilotBridge.endpoints.chat,
      health: kwaipilotBridge.endpoints.health,
    };

    if (initial.chat && initial.health) {
      const key = `${initial.chat}::${initial.health}`;
      seen.add(key);
      candidates.push(initial);
    }

    if (usingDefaultGateway) {
      const directBases = ['http://127.0.0.1:8080', 'http://localhost:8080'];
      if (typeof window !== 'undefined' && window.location && window.location.hostname) {
        directBases.push(`http://${window.location.hostname}:8080`);
      }
      for (const base of directBases) {
        const candidate = {
          chat: joinUrl(base, '/chat'),
          health: joinUrl(base, '/health'),
        };
        const key = `${candidate.chat}::${candidate.health}`;
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push(candidate);
        }
      }
    }

    return candidates;
  }

  async function probeKwaipilotCandidate(candidate) {
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

  async function autoConfigureKwaipilotEndpoints() {
    const previousChat = kwaipilotBridge.endpoints.chat;
    const previousHealth = kwaipilotBridge.endpoints.health;
    const candidates = buildKwaipilotCandidates();

    for (const candidate of candidates) {
      const probe = await probeKwaipilotCandidate(candidate);
      if (probe.ok) {
        kwaipilotBridge.endpoints.chat = candidate.chat;
        kwaipilotBridge.endpoints.health = candidate.health;
        const changed = candidate.chat !== previousChat || candidate.health !== previousHealth;
        if (changed) {
          logToTerminal(`Kwaipilot endpoint updated to ${candidate.chat}`, 'system');
        }
        return { configured: true, changed, payload: probe.payload };
      }
    }

    return { configured: Boolean(previousChat), changed: false, payload: null };
  }

  function updateHeroStatus(status, message) {
    kwaipilotBridge.status = status;
    if (heroResponseContainer) {
      heroResponseContainer.dataset.status = status;
      heroResponseContainer.dataset.provider = kwaipilotBridge.provider;
    }
    if (heroResponseText) {
      heroResponseText.dataset.status = status;
      heroResponseText.dataset.provider = kwaipilotBridge.provider;
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

  async function requestKwaipilotResponse(prompt) {
    const payload = { prompt };
    if (typeof kwaipilotBridge.defaults.maxNewTokens === 'number') {
      payload.max_new_tokens = kwaipilotBridge.defaults.maxNewTokens;
    }
    if (typeof kwaipilotBridge.defaults.temperature === 'number') {
      payload.temperature = kwaipilotBridge.defaults.temperature;
    }

    const response = await fetch(kwaipilotBridge.endpoints.chat, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const errorPayload = await response.json();
        if (errorPayload && typeof errorPayload.detail === 'string') {
          detail = errorPayload.detail;
        }
      } catch (parseError) {
        // Ignore JSON parse issues and surface the HTTP code instead
      }

      if (response.status === 405) {
        detail =
          'Kwaipilot gateway rejected the request. Configure the reverse proxy to allow POST /chat requests.';
      } else if (response.status === 404) {
        detail = 'Kwaipilot gateway endpoint not found. Configure the reverse proxy to expose /chat.';
      }

      const httpError = new Error(detail);
      httpError.status = response.status;
      throw httpError;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    const text = await response.text();
    return { response: text, tokens_generated: null };
  }

  async function checkKwaipilotHealth(prefetchedPayload) {
    if (!kwaipilotBridge.endpoints.health) {
      updateHeroStatus(
        'offline',
        'Kwaipilot endpoint is not configured. Configure the gateway to enable live responses.',
      );
      return;
    }

    if (prefetchedPayload && typeof prefetchedPayload === 'object') {
      const modelName = typeof prefetchedPayload.model === 'string' ? prefetchedPayload.model : 'Kwaipilot';
      updateHeroStatus('online', `${modelName} channel ready. Share an intention to receive a reflection.`);
      logToTerminal(`Kwaipilot online (${modelName}).`, 'system');
      return;
    }

    updateHeroStatus('checking', 'Checking Kwaipilot status…');
    try {
      const response = await fetch(kwaipilotBridge.endpoints.health, {
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
      const modelName = payload && typeof payload.model === 'string' ? payload.model : 'Kwaipilot';
      updateHeroStatus('online', `${modelName} channel ready. Share an intention to receive a reflection.`);
      logToTerminal(`Kwaipilot online (${modelName}).`, 'system');
    } catch (error) {
      const reason = normaliseError(error);
      updateHeroStatus(
        'offline',
        'Kwaipilot channel is offline. Prompts are stored locally until the agent returns.',
      );
      logToTerminal(`Kwaipilot health check failed: ${reason}`, 'warning');
    }
  }

  async function initializeKwaipilotBridge() {
    if (!heroResponseText) return;
    updateHeroStatus('calibrating', 'Calibrating the Kwaipilot channel…');

    const resolution = await autoConfigureKwaipilotEndpoints();

    if (!kwaipilotBridge.endpoints.chat) {
      updateHeroStatus(
        'offline',
        'Kwaipilot endpoint is not configured. Configure the gateway to enable live responses.',
      );
      return;
    }

    await checkKwaipilotHealth(resolution.payload);
  }

  async function handleHeroPromptSubmit(event) {
    if (!heroPromptInput || !heroResponseText) return;
    event.preventDefault();
    const message = heroPromptInput.value.trim();
    if (!message) {
      updateHeroStatus('warning', 'Share a prompt so Infinity can calibrate the Kwaipilot channel.');
      heroPromptInput.focus();
      return;
    }

    if (!kwaipilotBridge.endpoints.chat) {
      updateHeroStatus(
        'offline',
        'Kwaipilot endpoint is not configured. Configure the gateway to enable live responses.',
      );
      return;
    }

    setHeroPromptBusy(true);
    updateHeroStatus('sending', 'Transmitting intention to Kwaipilot…');

    let shouldRefocus = false;
    let fallbackModel = null;

    try {
      const payload = await (async () => {
        let lastError;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            return await requestKwaipilotResponse(message);
          } catch (error) {
            lastError = error;
            const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined;
            if (attempt === 0 && (status === 404 || status === 405)) {
              const resolution = await autoConfigureKwaipilotEndpoints();
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
        updateHeroStatus('responded', `Kwaipilot › ${truncateText(completion, 480)}`);
        logToTerminal(`Kwaipilot › ${completion}`, 'kwaipilot');
      } else {
        updateHeroStatus('responded', 'Kwaipilot responded with an empty message.');
        logToTerminal('Kwaipilot returned an empty response.', 'warning');
      }
      if (payload && typeof payload.tokens_generated === 'number') {
        logToTerminal(`Tokens generated: ${payload.tokens_generated}`, 'system');
      }
      if (fallbackModel) {
        logToTerminal(`Kwaipilot fallback channel confirmed (${fallbackModel}).`, 'system');
      }
      heroPromptInput.value = '';
      shouldRefocus = true;
    } catch (error) {
      const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined;
      const reason = normaliseError(error);
      if (status === 404 || status === 405) {
        updateHeroStatus(
          'offline',
          'Kwaipilot gateway is not accepting chat requests. Configure the reverse proxy to forward POST /chat to the agent.',
        );
        logToTerminal(`Kwaipilot gateway refused the request (${reason}).`, 'warning');
      } else {
        updateHeroStatus('error', `Kwaipilot request failed: ${reason}`);
        logToTerminal(`Kwaipilot request failed: ${reason}`, 'error');
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
  initializeKwaipilotBridge();
  logToTerminal('Neural terminal initialized. Type "help" to see available commands.');
})();
