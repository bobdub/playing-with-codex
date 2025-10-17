(function () {
  const storageKey = 'imagination-network-prompts';
  const promptForm = document.getElementById('prompt-form');
  const promptInput = document.getElementById('prompt-input');
  const promptTagInput = document.getElementById('prompt-tag');
  const promptIntensity = document.getElementById('prompt-intensity');
  const promptList = document.getElementById('prompt-list');
  const nodeCount = document.getElementById('node-count');
  const searchInput = document.getElementById('search-input');
  const topicList = document.getElementById('topic-list');
  const terminalLog = document.getElementById('terminal-log');
  const terminalForm = document.getElementById('terminal-form');
  const terminalInput = document.getElementById('terminal-input');

  /** @type {{id: string; file: string; occurrences: number; preview: string; symbolPath: string[]}[]} */
  let topics = [];
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

  function renderPrompts() {
    promptList.innerHTML = '';
    if (prompts.length === 0) {
      const empty = document.createElement('li');
      empty.textContent = 'No pulses recorded yet. Plant a prompt to begin the resonance.';
      promptList.appendChild(empty);
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
    return entries;
  }

  function renderTopics(list) {
    topicList.innerHTML = '';
    if (!list || list.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'topic-card';
      empty.textContent = 'No dream nodes match the current filters.';
      topicList.appendChild(empty);
      nodeCount.textContent = '0';
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
      renderTopics(topics);
      logToTerminal(`Loaded ${topics.length} dream nodes from the knowledge index.`);
    } catch (error) {
      logToTerminal(`Unable to load knowledge index: ${(error && error.message) || error}`);
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
  logToTerminal('Neural terminal initialized. Type "help" to see available commands.');
})();
