const controls = {
  totalAlbums: document.getElementById('total-albums'),
  batchSize: document.getElementById('batch-size'),
  minDelay: document.getElementById('min-delay'),
  maxDelay: document.getElementById('max-delay'),
  desktopColumns: document.getElementById('desktop-columns'),
  trickyPercent: document.getElementById('tricky-percent'),
  nameStyle: document.getElementById('name-style'),
  seed: document.getElementById('seed'),
  includeCreate: document.getElementById('include-create'),
  showMenu: document.getElementById('show-menu')
};

const buttons = {
  generate: document.getElementById('generate'),
  loadNext: document.getElementById('load-next'),
  autoLoad: document.getElementById('auto-load'),
  resetScroll: document.getElementById('reset-scroll')
};

const view = {
  status: document.getElementById('status'),
  grid: document.getElementById('album-grid'),
  loading: document.getElementById('loading-layer'),
  endMarker: document.getElementById('end-marker'),
  sentinel: document.getElementById('scroll-sentinel')
};

const imagePool = [
  'assets/photo-a.svg',
  'assets/photo-b.svg',
  'assets/photo-c.svg',
  'assets/photo-d.svg'
];

const words = {
  cities: [
    'Riverside', 'Orange County', 'Las Vegas', 'San Diego', 'Santa Clara', 'Seattle', 'Portland',
    'New York', 'Denver', 'Austin', 'Prague', 'Warsaw', 'Phoenix', 'Berlin'
  ],
  events: [
    'Birthday', 'New Year Trip', 'Holidays', 'Thanksgiving', 'Graduation', 'Family Weekend',
    'Kids Day', 'Road Trip', 'Beach Day', 'Museum Day', 'Hike', 'Picnic', 'Friends Meetup'
  ],
  tech: [
    'Screenshots', 'Google Chrome Notebook', 'Archive', 'Feature ideas', 'Product notes',
    'Reference photos', 'UI captures', 'Design drafts', 'Presentation assets', 'Camera uploads'
  ],
  suffixes: [
    '2010', '2012', '2018', '2020', '2022', '2024', '2025', '2026', 'Part 1', 'Part 2',
    'Weekend', 'Collection', 'v2', 'Final'
  ],
  tricky: [
    'A/B test screenshots',
    'Orange, 2025',
    'Old travel photos - 2001 and earlier',
    'Children science fair, 2010',
    '!!! TEMP album !!!',
    'Costa Mesa (late-night) // RAW',
    'Mom & Dad: 1980s scans',
    'Favorites - do-not-delete',
    'xYz misc 0042',
    'Emily birthday 16!'
  ]
};

const state = {
  albums: [],
  loaded: 0,
  config: null,
  lastGeneratedSnapshot: null,
  loading: false,
  autoLoad: false,
  observer: null,
  createdCardInserted: false
};

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function hash() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  return function rnd() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function getConfig() {
  const total = clampNumber(parseInt(controls.totalAlbums.value, 10), 20, 5000, 780);
  const batch = clampNumber(parseInt(controls.batchSize.value, 10), 6, 120, 24);
  const minDelay = clampNumber(parseInt(controls.minDelay.value, 10), 100, 5000, 1000);
  const maxDelay = clampNumber(parseInt(controls.maxDelay.value, 10), 100, 8000, 2000);
  const columns = clampNumber(parseInt(controls.desktopColumns.value, 10), 4, 8, 6);
  const trickyPercent = clampNumber(parseInt(controls.trickyPercent.value, 10), 0, 100, 18);

  controls.totalAlbums.value = String(total);
  controls.batchSize.value = String(batch);
  controls.minDelay.value = String(Math.min(minDelay, maxDelay));
  controls.maxDelay.value = String(Math.max(minDelay, maxDelay));
  controls.desktopColumns.value = String(columns);
  controls.trickyPercent.value = String(trickyPercent);

  const finalMin = Math.min(minDelay, maxDelay);
  const finalMax = Math.max(minDelay, maxDelay);

  return {
    total,
    batch,
    minDelay: finalMin,
    maxDelay: finalMax,
    columns,
    trickyPercent,
    style: controls.nameStyle.value,
    seed: controls.seed.value.trim() || 'table-filter-poc',
    includeCreate: controls.includeCreate.checked,
    showMenu: controls.showMenu.checked
  };
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function readConfigSnapshot() {
  return {
    totalAlbums: controls.totalAlbums.value,
    batchSize: controls.batchSize.value,
    minDelay: controls.minDelay.value,
    maxDelay: controls.maxDelay.value,
    desktopColumns: controls.desktopColumns.value,
    trickyPercent: controls.trickyPercent.value,
    nameStyle: controls.nameStyle.value,
    seed: controls.seed.value,
    includeCreate: String(controls.includeCreate.checked),
    showMenu: String(controls.showMenu.checked)
  };
}

function updateChangedState() {
  if (!state.lastGeneratedSnapshot) return;

  const current = readConfigSnapshot();
  let anyChanged = false;

  const fields = [
    controls.totalAlbums,
    controls.batchSize,
    controls.minDelay,
    controls.maxDelay,
    controls.desktopColumns,
    controls.trickyPercent,
    controls.nameStyle,
    controls.seed,
    controls.includeCreate,
    controls.showMenu
  ];

  fields.forEach(input => {
    const key = input.id
      .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const changed = current[key] !== state.lastGeneratedSnapshot[key];
    if (changed) anyChanged = true;
    const wrapper = input.closest('.control') || input.closest('.check');
    if (wrapper) wrapper.classList.toggle('changed', changed);
  });

  buttons.generate.classList.toggle('changed', anyChanged);
}

function buildAlbumTitle(rng, style, trickyMode) {
  if (trickyMode) {
    return pick(rng, words.tricky);
  }

  if (style === 'city-year') {
    return `${pick(rng, words.cities)}, ${pick(rng, words.suffixes)}`;
  }

  if (style === 'events') {
    return `${pick(rng, words.events)} ${pick(rng, words.suffixes)}`;
  }

  if (style === 'tech') {
    return `${pick(rng, words.tech)} (${randomInt(rng, 1, 12)})`;
  }

  const mode = randomInt(rng, 1, 4);
  if (mode === 1) return `${pick(rng, words.cities)}, ${pick(rng, words.suffixes)}`;
  if (mode === 2) return `${pick(rng, words.events)} ${pick(rng, words.suffixes)}`;
  if (mode === 3) return `${pick(rng, words.tech)} (${randomInt(rng, 1, 30)})`;
  return `${pick(rng, words.events)} in ${pick(rng, words.cities)}`;
}

function generateAlbums(config) {
  const seedHash = xmur3(config.seed)();
  const rng = mulberry32(seedHash);
  const albums = [];

  for (let i = 0; i < config.total; i += 1) {
    const trickyMode = rng() < config.trickyPercent / 100;
    const title = buildAlbumTitle(rng, config.style, trickyMode);
    const items = randomInt(rng, 1, 420);
    const photoCount = randomInt(rng, 12, 65);
    const photos = [];

    for (let p = 0; p < photoCount; p += 1) {
      photos.push({
        src: pick(rng, imagePool),
        caption: `${title} photo ${p + 1}`,
        tags: [pick(rng, words.events).toLowerCase(), pick(rng, words.cities).toLowerCase()]
      });
    }

    albums.push({
      id: i + 1,
      href: `https://www.facebook.com/media/set/?set=mock.${100000 + i}&type=3`,
      title,
      countLabel: `${items} Items`,
      cover: pick(rng, imagePool),
      showMenu: config.showMenu && rng() >= 0.03,
      photos
    });
  }

  return albums;
}

function renderCreateCard() {
  const article = document.createElement('article');
  article.className = 'create-card';
  article.dataset.afSystemCard = 'create';

  const link = document.createElement('a');
  link.href = '#';
  link.className = 'create-link';
  link.addEventListener('click', event => event.preventDefault());

  const cover = document.createElement('div');
  cover.className = 'create-cover';
  cover.textContent = '+';

  const title = document.createElement('div');
  title.className = 'create-title';
  title.textContent = 'Create album';

  link.appendChild(cover);
  link.appendChild(title);
  article.appendChild(link);
  return article;
}

function renderAlbumCard(album) {
  const article = document.createElement('article');
  article.className = 'album-card';
  article.dataset.afAlbumCard = '1';
  article.dataset.afAlbumId = String(album.id);

  const link = document.createElement('a');
  link.className = 'album-link';
  link.href = album.href;

  const cover = document.createElement('div');
  cover.className = 'album-cover';

  const img = document.createElement('img');
  img.src = album.cover;
  img.alt = '';
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  cover.appendChild(img);

  const title = document.createElement('div');
  title.className = 'album-title';
  title.dataset.afAlbumTitle = '1';
  title.textContent = album.title;

  const count = document.createElement('div');
  count.className = 'album-count';
  count.dataset.afAlbumCount = '1';
  count.textContent = album.countLabel;

  link.appendChild(cover);
  link.appendChild(title);
  link.appendChild(count);

  article.appendChild(link);

  if (album.showMenu) {
    const menu = document.createElement('button');
    menu.type = 'button';
    menu.className = 'album-menu';
    menu.setAttribute('aria-label', 'More options for album');
    menu.textContent = '...';
    menu.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
    });
    article.appendChild(menu);
  }

  return article;
}

function showSkeleton(count) {
  view.loading.innerHTML = '';
  const shell = document.createElement('div');
  shell.className = 'loading-grid';

  const skeletonCount = Math.max(1, Math.min(count, 24));
  for (let i = 0; i < skeletonCount; i += 1) {
    const card = document.createElement('div');
    card.className = 'skeleton-card';

    const cover = document.createElement('div');
    cover.className = 'skeleton-cover';

    const line1 = document.createElement('div');
    line1.className = 'skeleton-line long';

    const line2 = document.createElement('div');
    line2.className = 'skeleton-line short';

    card.appendChild(cover);
    card.appendChild(line1);
    card.appendChild(line2);
    shell.appendChild(card);
  }

  view.loading.appendChild(shell);
  view.loading.classList.remove('hidden');
}

function hideSkeleton() {
  view.loading.classList.add('hidden');
  view.loading.innerHTML = '';
}

function appendFillerCells() {
  const existingFillers = view.grid.querySelectorAll('.album-filler');
  existingFillers.forEach(node => node.remove());

  const renderedCards = view.grid.querySelectorAll('.album-card, .create-card').length;
  const remainder = renderedCards % state.config.columns;
  const fillerCount = remainder === 0 ? 0 : state.config.columns - remainder;

  for (let i = 0; i < fillerCount; i += 1) {
    const filler = document.createElement('div');
    filler.className = 'album-filler';
    filler.setAttribute('aria-hidden', 'true');
    view.grid.appendChild(filler);
  }
}

async function loadNextBatch(reason) {
  if (state.loading || state.loaded >= state.albums.length) return;

  state.loading = true;
  const remaining = state.albums.length - state.loaded;
  const take = Math.min(state.config.batch, remaining);

  setStatus(`${reason} • Loading ${take} more albums...`);
  showSkeleton(take);

  const delay = randomInt(Math.random, state.config.minDelay, state.config.maxDelay);
  await sleep(delay);

  const nextSlice = state.albums.slice(state.loaded, state.loaded + take);
  const fragment = document.createDocumentFragment();

  if (state.config.includeCreate && !state.createdCardInserted) {
    fragment.appendChild(renderCreateCard());
    state.createdCardInserted = true;
  }

  nextSlice.forEach(album => fragment.appendChild(renderAlbumCard(album)));
  view.grid.appendChild(fragment);
  state.loaded += take;

  hideSkeleton();
  state.loading = false;

  if (state.loaded >= state.albums.length) {
    appendFillerCells();
    view.endMarker.classList.remove('hidden');
    if (state.autoLoad) {
      state.autoLoad = false;
      updateAutoLoadButton();
    }
    setStatus(`Complete • Loaded ${state.loaded} / ${state.albums.length} albums`);
    return;
  }

  setStatus(`Loaded ${state.loaded} / ${state.albums.length} albums`);
}

function setStatus(text) {
  view.status.textContent = text;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function applyColumns() {
  document.documentElement.style.setProperty('--grid-cols', String(state.config.columns));
}

async function runAutoLoad() {
  while (state.autoLoad && state.loaded < state.albums.length) {
    await loadNextBatch('Auto-load');
    if (!state.autoLoad || state.loaded >= state.albums.length) break;
    await sleep(120);
  }
}

function updateAutoLoadButton() {
  buttons.autoLoad.setAttribute('aria-pressed', state.autoLoad ? 'true' : 'false');
  buttons.autoLoad.textContent = state.autoLoad ? 'Stop auto-load' : 'Auto-load all';
}

function clearList() {
  state.loaded = 0;
  state.loading = false;
  state.createdCardInserted = false;
  state.autoLoad = false;
  updateAutoLoadButton();

  view.grid.innerHTML = '';
  hideSkeleton();
  view.endMarker.classList.add('hidden');
}

function initObserver() {
  if (state.observer) {
    state.observer.disconnect();
  }

  state.observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadNextBatch('Scroll');
      }
    });
  }, {
    root: null,
    rootMargin: '600px 0px 600px 0px',
    threshold: 0
  });

  state.observer.observe(view.sentinel);
}

function generateList() {
  state.config = getConfig();
  applyColumns();
  clearList();

  state.albums = generateAlbums(state.config);
  state.lastGeneratedSnapshot = readConfigSnapshot();
  updateChangedState();
  setStatus(`Dataset ready • ${state.albums.length} albums`);

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  loadNextBatch('Initial');
}

buttons.generate.addEventListener('click', generateList);

buttons.loadNext.addEventListener('click', () => {
  loadNextBatch('Manual load');
});

buttons.autoLoad.addEventListener('click', () => {
  if (state.loaded >= state.albums.length) return;
  state.autoLoad = !state.autoLoad;
  updateAutoLoadButton();
  if (state.autoLoad) {
    runAutoLoad();
  }
});

buttons.resetScroll.addEventListener('click', () => {
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
});

Object.values(controls).forEach(control => {
  control.addEventListener('input', updateChangedState);
  control.addEventListener('change', updateChangedState);
});

initObserver();
generateList();
