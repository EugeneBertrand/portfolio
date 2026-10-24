console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

const BASE_PATH =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? '/'
    : '/portfolio/';

const pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'resume/', title: 'Resume' },
  { url: 'contact/', title: 'Contact' },
  { url: 'https://github.com/EugeneBertrand', title: 'GitHub' },
];

const nav = document.createElement('nav');

for (const page of pages) {
  const url = page.url.startsWith('http')
    ? page.url
    : `${BASE_PATH}${page.url}`;
  const link = document.createElement('a');
  link.href = url;
  link.textContent = page.title;

  if (link.host === location.host && link.pathname === location.pathname) {
    link.classList.add('current');
  }

  if (link.host !== location.host) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }

  nav.append(link);
}

document.body.prepend(nav);

document.body.insertAdjacentHTML(
  'afterbegin',
  `<label class="color-scheme">
    Theme:
    <select aria-label="Color theme">
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>`,
);

const themeSelect = document.querySelector('.color-scheme select');

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty('color-scheme', colorScheme);
  themeSelect.value = colorScheme;
}

if ('colorScheme' in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

themeSelect.addEventListener('input', (event) => {
  const colorScheme = event.target.value;
  setColorScheme(colorScheme);
  localStorage.colorScheme = colorScheme;
});

const form = document.querySelector('form');

form?.addEventListener('submit', (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const parameters = [];

  for (const [name, value] of data) {
    parameters.push(`${name}=${encodeURIComponent(value)}`);
  }

  location.href = `${form.action}?${parameters.join('&')}`;
});

export async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed (${response.status} ${response.statusText})`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Unable to load data from ${url}:`, error);
    throw error;
  }
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  if (!(containerElement instanceof Element)) {
    throw new TypeError('A valid project container is required.');
  }

  const safeHeadingLevel = /^h[1-6]$/i.test(headingLevel)
    ? headingLevel.toLowerCase()
    : 'h2';
  containerElement.replaceChildren();

  if (!Array.isArray(projects) || projects.length === 0) {
    const message = document.createElement('p');
    message.textContent = 'No projects to display.';
    containerElement.append(message);
    return;
  }

  for (const project of projects) {
    const article = document.createElement('article');
    const heading = document.createElement(safeHeadingLevel);
    heading.textContent = project.title || 'Untitled project';
    article.append(heading);

    if (project.image) {
      const image = document.createElement('img');
      image.src = new URL(project.image, new URL(BASE_PATH, location.origin));
      image.alt = `${project.title || 'Project'} preview`;
      image.loading = 'lazy';
      article.append(image);
    }

    if (project.year) {
      const year = document.createElement('p');
      year.className = 'project-year';
      year.textContent = String(project.year);
      article.append(year);
    }

    const description = document.createElement('p');
    description.textContent = project.description || 'No description provided.';
    article.append(description);
    containerElement.append(article);
  }
}

export async function fetchGithubData(username) {
  return fetchJSON(`https://api.github.com/users/${encodeURIComponent(username)}`);
}
