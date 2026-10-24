import { fetchGithubData, fetchJSON, renderProjects } from './global.js';

const projectsContainer = document.querySelector('#latest-projects');
const projectsTitle = document.querySelector('.projects-title');
const profileStats = document.querySelector('#profile-stats');

async function loadLatestProjects() {
  try {
    const projects = await fetchJSON('./lib/projects.json');
    if (projectsTitle) {
      projectsTitle.textContent = `Latest Projects (${projects.length})`;
    }
    renderProjects(projects.slice(0, 3), projectsContainer, 'h3');
  } catch (error) {
    if (projectsContainer) {
      projectsContainer.textContent = 'Projects could not be loaded.';
    }
  }
}

async function loadGithubStats() {
  try {
    const githubData = await fetchGithubData('EugeneBertrand');
    if (!profileStats) return;

    const stats = [
      ['Public repositories', githubData.public_repos],
      ['Public gists', githubData.public_gists],
      ['Followers', githubData.followers],
      ['Following', githubData.following]
    ];
    const list = document.createElement('dl');

    for (const [label, value] of stats) {
      const item = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = String(value);
      item.append(term, description);
      list.append(item);
    }

    profileStats.replaceChildren(list);
  } catch (error) {
    if (profileStats) {
      profileStats.textContent = 'GitHub stats are currently unavailable.';
    }
  }
}

loadLatestProjects();
loadGithubStats();
