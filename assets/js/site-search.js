(function () {
  'use strict';

  const root = document.querySelector('[data-site-search]');
  if (!root) return;

  const form = root.querySelector('[data-search-form]');
  const input = root.querySelector('[data-search-input]');
  const status = root.querySelector('[data-search-status]');
  const results = root.querySelector('[data-search-results]');
  const indexUrl = root.dataset.indexUrl;
  const lang = root.dataset.lang || document.documentElement.lang || 'sr';
  const baseUrl = String(root.dataset.baseUrl || '').replace(/\/$/, '');

  let index = [];
  let loaded = false;

  const strings = {
    start: status.dataset.startText,
    loading: status.dataset.loadingText,
    error: status.dataset.errorText,
    none: status.dataset.noResultsText,
    one: status.dataset.resultOne,
    many: status.dataset.resultMany,
    open: results.dataset.openLabel,
    page: results.dataset.pageLabel,
    post: results.dataset.postLabel
  };

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLocaleLowerCase(lang)
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function prepare(item) {
    item._title = normalize(item.title);
    item._subtitle = normalize(item.subtitle);
    item._content = normalize(item.content);
    item._all = [item._title, item._subtitle, item._content].join(' ');
    return item;
  }

  function score(item, query, tokens) {
    if (!tokens.every((token) => item._all.includes(token))) return -1;

    let value = 0;
    if (item._title === query) value += 120;
    else if (item._title.includes(query)) value += 75;
    if (item._subtitle.includes(query)) value += 28;
    if (item._content.includes(query)) value += 14;

    tokens.forEach((token) => {
      if (item._title.includes(token)) value += 22;
      if (item._subtitle.includes(token)) value += 8;
      if (item._content.includes(token)) value += 3;
    });

    if (item.type === 'page') value += 2;
    return value;
  }

  function snippet(item, tokens) {
    const source = String(item.content || item.subtitle || '');
    if (!source) return '';

    const normalized = normalize(source);
    let matchIndex = -1;
    for (const token of tokens) {
      const candidate = normalized.indexOf(token);
      if (candidate !== -1 && (matchIndex === -1 || candidate < matchIndex)) matchIndex = candidate;
    }

    const start = Math.max(0, matchIndex > 0 ? matchIndex - 90 : 0);
    const end = Math.min(source.length, start + 290);
    let text = source.slice(start, end).trim();
    if (start > 0) text = '…' + text;
    if (end < source.length) text += '…';
    return text;
  }

  function localUrl(value) {
    const url = String(value || '');
    if (!url.startsWith('/') || !baseUrl || url === baseUrl || url.startsWith(baseUrl + '/')) return url;
    return baseUrl + url;
  }

  function render(queryValue) {
    const query = normalize(queryValue);
    results.innerHTML = '';

    if (!loaded) {
      status.textContent = strings.loading;
      return;
    }

    if (query.length < 2) {
      status.textContent = strings.start;
      return;
    }

    const tokens = query.split(/\s+/).filter(Boolean);
    const matches = index
      .map((item) => ({ item, score: score(item, query, tokens) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, lang))
      .slice(0, 60);

    if (!matches.length) {
      status.textContent = strings.none;
      return;
    }

    status.textContent = matches.length + ' ' + (matches.length === 1 ? strings.one : strings.many);

    const fragment = document.createDocumentFragment();
    matches.forEach(({ item }) => {
      const article = document.createElement('article');
      article.className = 'site-search-result';
      const typeLabel = item.type === 'post' ? strings.post : strings.page;
      const excerpt = snippet(item, tokens);
      article.innerHTML =
        '<div class="site-search-result-meta">' + escapeHtml(typeLabel) + '</div>' +
        '<h2><a href="' + escapeHtml(localUrl(item.url)) + '">' + escapeHtml(item.title) + '</a></h2>' +
        (item.subtitle ? '<p class="site-search-result-subtitle">' + escapeHtml(item.subtitle) + '</p>' : '') +
        (excerpt ? '<p>' + escapeHtml(excerpt) + '</p>' : '') +
        '<a class="site-search-result-link" href="' + escapeHtml(localUrl(item.url)) + '">' + escapeHtml(strings.open) + ' <span aria-hidden="true">→</span></a>';
      fragment.appendChild(article);
    });
    results.appendChild(fragment);
  }

  function updateUrl(value) {
    const url = new URL(window.location.href);
    const trimmed = String(value || '').trim();
    if (trimmed) url.searchParams.set('q', trimmed);
    else url.searchParams.delete('q');
    window.history.replaceState({}, '', url);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    updateUrl(input.value);
    render(input.value);
  });

  let debounceTimer;
  input.addEventListener('input', function () {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(function () {
      updateUrl(input.value);
      render(input.value);
    }, 120);
  });

  status.textContent = strings.loading;
  fetch(indexUrl, { credentials: 'same-origin' })
    .then(function (response) {
      if (!response.ok) throw new Error('Search index HTTP ' + response.status);
      return response.json();
    })
    .then(function (data) {
      index = Array.isArray(data) ? data.map(prepare) : [];
      loaded = true;
      const query = new URLSearchParams(window.location.search).get('q') || '';
      input.value = query;
      render(query);
      input.focus({ preventScroll: true });
    })
    .catch(function () {
      loaded = false;
      status.textContent = strings.error;
    });
})();
