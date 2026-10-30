import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');
const svg = d3.select('#projects-pie-plot');
const legend = d3.select('.legend');

let projects = [];
let query = '';
let selectedYear = null;

function updateTitle(count) {
  if (projectsTitle) {
    projectsTitle.textContent = `Projects (${count})`;
  }
}

function getSearchFilteredProjects() {
  const normalizedQuery = query.trim().toLowerCase();
  let filteredProjects = [...projects];

  if (normalizedQuery) {
    filteredProjects = filteredProjects.filter((project) => {
      const searchableText = Object.values(project).join('\n').toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }

  return filteredProjects;
}

function getFilteredProjects() {
  const filteredProjects = getSearchFilteredProjects();

  if (selectedYear) {
    return filteredProjects.filter((project) => String(project.year) === selectedYear);
  }

  return filteredProjects;
}

function renderPieChart(projectsGiven) {
  const rolledData = d3
    .rollups(projectsGiven, (values) => values.length, (project) => String(project.year))
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([label, value]) => ({ label, value }));

  const palette = ['#b8d7e8', '#6ea8cd', '#b9d9b0', '#dcb1c4'];
  const colors = d3.scaleOrdinal().domain(rolledData.map((d) => d.label)).range(palette);
  const sliceGenerator = d3.pie().sort(null).value((d) => d.value);
  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  const arcs = sliceGenerator(rolledData);

  svg.selectAll('path').remove();
  legend.selectAll('*').remove();

  if (rolledData.length === 0) {
    svg
      .append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .attr('fill', 'currentColor')
      .text('No matches');
    return;
  }

  svg
    .selectAll('path')
    .data(arcs)
    .join('path')
    .attr('d', (d) => arcGenerator(d))
    .attr('fill', (d) => colors(d.data.label))
    .attr('stroke', 'white')
    .attr('stroke-width', 1.4)
    .attr('class', (d) => (selectedYear === d.data.label ? 'selected' : ''))
    .style('fill', (d) => (selectedYear === d.data.label ? '#d98ca9' : colors(d.data.label)))
    .on('click', (_, d) => {
      const year = d.data.label;
      selectedYear = selectedYear === year ? null : year;
      renderUI();
    });

  legend
    .selectAll('li')
    .data(rolledData)
    .join('li')
    .attr('class', (d) => (selectedYear === d.label ? 'selected' : ''))
    .style('--color', (d) => colors(d.label))
    .on('click', (_, d) => {
      selectedYear = selectedYear === d.label ? null : d.label;
      renderUI();
    })
    .each(function (d) {
      const item = d3.select(this);
      item.html('');
      item.append('span').attr('class', 'swatch');
      item.append('span').text(`${d.label} (${d.value})`);
      item.select('.swatch').style('background', selectedYear === d.label ? '#d98ca9' : colors(d.label));
    });
}

function renderUI() {
  const visibleProjects = getFilteredProjects();
  const chartProjects = getSearchFilteredProjects();

  updateTitle(visibleProjects.length);
  renderProjects(visibleProjects, projectsContainer, 'h2');
  renderPieChart(chartProjects);
}

async function loadProjects() {
  try {
    projects = await fetchJSON('../lib/projects.json');
    renderUI();
  } catch (error) {
    if (projectsContainer) {
      projectsContainer.textContent = 'Projects could not be loaded.';
    }
  }
}

if (searchInput) {
  searchInput.addEventListener('input', (event) => {
    query = event.target.value;
    renderUI();
  });
}

loadProjects();
