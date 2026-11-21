import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3/+esm';

let xScale;
let yScale;
let commits;
let commitProgress = 100;
let commitMaxTime;
let timeScale;
let filteredCommits;
let colors;
let brushBehavior;

async function loadData() {
  return d3.csv('./loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(`${row.date}T00:00${row.timezone}`),
    datetime: new Date(row.datetime),
  }));
}

function processCommits(data) {
  return d3.groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      const ret = {
        id: commit,
        url: `https://github.com/EugeneBertrand/portfolio/commit/${commit}`,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };
      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: true,
        writable: true,
        enumerable: false,
      });
      return ret;
    })
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));
}

function renderCommitInfo(data, commitData) {
  const list = d3.select('#stats').append('dl');
  const fileLines = d3.rollups(data, (v) => v.length, (d) => d.file);
  const fileCount = fileLines.length;
  const maxFileLines = d3.max(fileLines, (d) => d[1]);
  const maximumDepth = d3.max(data, (d) => d.depth);
  const longestLine = d3.max(data, (d) => d.length);

  const entries = [
    ['Commits', commitData.length],
    ['Files', fileCount],
    ['Total LOC', data.length],
    ['Max depth', maximumDepth ?? 'N/A'],
    ['Longest line', longestLine ?? 'N/A'],
    ['Max lines', maxFileLines ?? 'N/A'],
  ];

  entries.forEach(([label, value]) => {
    const entry = list.append('div');
    entry.append('dt').text(label);
    entry.append('dd').text(value);
  });
}

function renderScatterPlot(commitData) {
  const width = 1000;
  const height = 600;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };

  const svg = d3.select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3.scaleTime()
    .domain(d3.extent(commitData, (d) => d.datetime))
    .range([margin.left, width - margin.right]);

  yScale = d3.scaleLinear().domain([0, 24]).range([margin.top, height - margin.bottom]);

  svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-(width - margin.left - margin.right)));

  svg.append('g')
    .attr('class', 'x-axis axis')
    .attr('transform', `translate(0, ${height - margin.bottom})`);

  svg.append('g')
    .attr('class', 'y-axis axis')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat((d) => `${String(d % 24).padStart(2, '0')}:00`));

  svg.append('g').attr('class', 'dots');
  brushBehavior = d3.brush()
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
    .on('start brush end', brushed);
  svg.call(brushBehavior);

  updateScatterPlot(commitData);
  svg.selectAll('.dots').raise();
}

function updateScatterPlot(commitData) {
  const width = 1000;
  const height = 600;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const svg = d3.select('#chart').select('svg');

  if (!commitData.length) {
    svg.select('.dots').selectAll('circle').remove();
    return;
  }

  xScale.domain(d3.extent(commitData, (d) => d.datetime));
  const [minLines, maxLines] = d3.extent(commitData, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([4, 16]);

  svg.select('.x-axis')
    .transition().duration(500)
    .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%b %d')));

  const dots = svg.select('g.dots');
  const sortedCommits = d3.sort(commitData, (a, b) => b.totalLines - a.totalLines);

  dots.selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join(
      (enter) => enter.append('circle')
        .attr('class', 'entering')
        .attr('cx', (d) => xScale(d.datetime))
        .attr('cy', (d) => yScale(d.hourFrac))
        .attr('r', 0)
        .call((selection) => selection.transition().duration(500).attr('r', (d) => rScale(d.totalLines))),
      (update) => update,
      (exit) => exit.transition().duration(300).attr('r', 0).remove(),
    )
    .attr('fill', '#3b82f6')
    .attr('fill-opacity', 0.7)
    .transition().duration(500)
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines));

  dots.selectAll('circle')
    .on('mouseenter', (event, commit) => {
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
      d3.select(event.currentTarget).attr('fill-opacity', 1);
    })
    .on('mousemove', updateTooltipPosition)
    .on('mouseleave', (event) => {
      updateTooltipVisibility(false);
      d3.select(event.currentTarget).attr('fill-opacity', 0.7);
    });
}

function updateTooltipVisibility(isVisible) {
  document.getElementById('commit-tooltip').hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX + 16}px`;
  tooltip.style.top = `${event.clientY + 18}px`;
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time-tooltip');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (!commit) return;
  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', { dateStyle: 'full' });
  time.textContent = commit.datetime?.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
  author.textContent = commit.author;
  lines.textContent = `${commit.totalLines} lines edited`;
}

function isCommitSelected(selection, commit) {
  if (!Array.isArray(selection) || selection.length !== 2) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= Math.min(x0, x1) && x <= Math.max(x0, x1)
    && y >= Math.min(y0, y1) && y <= Math.max(y0, y1);
}

function renderSelectionCount(selection) {
  const hasSelection = Array.isArray(selection) && selection.length === 2;
  const selectedCommits = hasSelection ? filteredCommits.filter((d) => isCommitSelected(selection, d)) : [];
  document.querySelector('#selection-count').textContent = `${selectedCommits.length || 'No'} commits selected`;
  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const hasSelection = Array.isArray(selection) && selection.length === 2;
  const selectedCommits = hasSelection ? filteredCommits.filter((d) => isCommitSelected(selection, d)) : [];
  const container = document.getElementById('language-breakdown');

  if (!hasSelection || selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const rows = selectedCommits.flatMap((d) => d.lines);
  const breakdown = d3.rollup(rows, (v) => v.length, (d) => d.type);
  container.innerHTML = '';
  for (const [language, count] of breakdown) {
    const proportion = count / rows.length;
    const dt = document.createElement('dt');
    dt.textContent = language;
    const dd = document.createElement('dd');
    dd.textContent = `${count} lines (${d3.format('.1~%')(proportion)})`;
    container.append(dt, dd);
  }
}

function brushed(event) {
  const selection = event.selection;
  d3.select('#chart svg g.dots').selectAll('circle')
    .classed('selected', (d) => isCommitSelected(selection, d));
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function updateFileDisplay(filtered) {
  const lines = filtered.flatMap((d) => d.lines);
  const files = d3.groups(lines, (d) => d.file)
    .map(([name, fileLines]) => ({ name, lines: fileLines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3.select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join(
      (enter) => enter.append('div').call((div) => {
        div.append('dt').append('code');
        div.append('dt').attr('class', 'file-count').append('small');
        div.append('dd');
      }),
    );

  filesContainer.select('dt code').text((d) => d.name);
  filesContainer.select('dt.file-count small').text((d) => `${d.lines.length} lines`);
  filesContainer.select('dd')
    .selectAll('div.loc')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .style('--color', (d) => colors(d.type));
}

function onTimeSliderChange() {
  commitProgress = Number(document.querySelector('#commit-progress').value);
  commitMaxTime = timeScale.invert(commitProgress);
  document.querySelector('#commit-time').textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  updateScatterPlot(filteredCommits);
  updateFileDisplay(filteredCommits);
  brushBehavior.move(d3.select('#chart svg'), null);
  renderSelectionCount([]);
  renderLanguageBreakdown([]);
}

function onStepEnter(response) {
  d3.selectAll('#scatter-story .step').classed('is-active', false);
  d3.select(response.element).classed('is-active', true);
  const commit = response.element.__data__;
  if (!commit) return;
  commitMaxTime = commit.datetime;
  commitProgress = timeScale(commitMaxTime);
  document.querySelector('#commit-progress').value = String(Math.round(commitProgress));
  document.querySelector('#commit-time').textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  updateScatterPlot(filteredCommits);
  updateFileDisplay(filteredCommits);
}

async function main() {
  const data = await loadData();
  commits = processCommits(data);
  filteredCommits = commits;
  colors = d3.scaleOrdinal(d3.schemeTableau10);

  timeScale = d3.scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([0, 100]);
  commitMaxTime = d3.max(commits, (d) => d.datetime);

  document.querySelector('#commit-progress').value = '100';
  document.querySelector('#commit-time').textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  document.querySelector('#commit-progress').addEventListener('input', onTimeSliderChange);

  renderCommitInfo(data, commits);
  renderScatterPlot(commits);
  updateFileDisplay(commits);

  d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html((d, i) => `
      <p>On ${d.datetime.toLocaleString('en', { dateStyle: 'full', timeStyle: 'short' })},
      I made <a href="${d.url}" target="_blank" rel="noreferrer">${i === 0 ? 'my first commit, and it was glorious' : 'another glorious commit'}</a>.
      I edited ${d.totalLines} lines across ${d3.rollups(d.lines, (lines) => lines.length, (line) => line.file).length} files.</p>
    `);

  const scroller = scrollama();
  scroller.setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
    offset: 0.5,
  }).onStepEnter(onStepEnter);
}

main().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML(
    'beforeend',
    '<p style="padding: 1rem; color: #b91c1c;">The meta visualization could not be loaded.</p>',
  );
});
