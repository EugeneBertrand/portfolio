import { fetchJSON, renderProjects } from '../global.js';

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');

async function loadProjects() {
  try {
    const projects = await fetchJSON('../lib/projects.json');
    if (projectsTitle) {
      projectsTitle.textContent = `Projects (${projects.length})`;
    }
    renderProjects(projects, projectsContainer, 'h2');
  } catch (error) {
    if (projectsContainer) {
      projectsContainer.textContent = 'Projects could not be loaded.';
    }
  }
}

loadProjects();
