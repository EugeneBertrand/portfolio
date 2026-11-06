import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

let xScale;
let yScale;
let commits;

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
  return d3.groups(data, (d) => d.commit).map(([commit, lines]) => {
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
  });
}

function renderCommitInfo(data, commitData) {
  const stats = d3.select('#stats');
  const list = stats.append('dl');

  const fileCount = d3.group(data, (d) => d.file).size;
  const fileLengths = d3.rollups(data, (v) => d3.max(v, (d) => d.line), (d) => d.file);
  const averageFileLength = d3.mean(fileLengths, (d) => d[1]);
  const maximumDepth = d3.max(data, (d) => d.depth);
  const averageDepth = d3.mean(data, (d) => d.depth);
  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' }),
  );
  const mostActivePeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0] ?? 'N/A';

  const entries = [
    ['Total LOC', data.length],
    ['Total commits', commitData.length],
    ['Files', fileCount],
    ['Avg file length', `${averageFileLength ? averageFileLength.toFixed(1) : 'N/A'} lines`],
    ['Max depth', maximumDepth ?? 'N/A'],
    ['Avg depth', `${averageDepth ? averageDepth.toFixed(2) : 'N/A'}`],
    ['Most active period', mostActivePeriod],
  ];

  entries.forEach(([label, value]) => {
    list.append('dt').text(label);
    list.append('dd').text(value);
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
    .range([margin.left, width - margin.right])
    .nice();

  yScale = d3.scaleLinear().domain([0, 24]).range([height - margin.bottom, margin.top]);

  const [minLines, maxLines] = d3.extent(commitData, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([4, 16]);

  svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-(width - margin.left - margin.right)));

  const xAxis = d3.axisBottom(xScale).tickFormat(d3.timeFormat('%b %d'));
  const yAxis = d3.axisLeft(yScale).tickFormat((d) => `${String(d % 24).padStart(2, '0')}:00`);

  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0, ${height - margin.bottom})`)
    .call(xAxis);

  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(yAxis);

  const dots = svg.append('g').attr('class', 'dots');
  const sortedCommits = d3.sort(commitData, (a, b) => b.totalLines - a.totalLines);

  dots.selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', '#3b82f6')
    .attr('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
      d3.select(event.currentTarget).style('fill-opacity', 1);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      updateTooltipVisibility(false);
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
    });

  svg.call(
    d3.brush()
      .extent([
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom],
      ])
      .on('start brush end', brushed),
  );

  svg.selectAll('.overlay').raise();
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX + 16}px`;
  tooltip.style.top = `${event.clientY + 18}px`;
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (!commit || Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', { dateStyle: 'full' });
  author.textContent = commit.author;
  lines.textContent = `${commit.totalLines} lines edited`;
}

function isCommitSelected(selection, commit) {
  if (!Array.isArray(selection) || selection.length !== 2) return false;

  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function renderSelectionCount(selection) {
  const hasSelection = Array.isArray(selection) && selection.length === 2;
  const selectedCommits = hasSelection ? commits.filter((d) => isCommitSelected(selection, d)) : [];
  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;
  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const hasSelection = Array.isArray(selection) && selection.length === 2;
  const selectedCommits = hasSelection ? commits.filter((d) => isCommitSelected(selection, d)) : [];
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
    const formatted = d3.format('.1~%')(proportion);

    const dt = document.createElement('dt');
    dt.textContent = language;

    const dd = document.createElement('dd');
    dd.textContent = `${count} lines (${formatted})`;

    container.append(dt, dd);
  }
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', (d) => isCommitSelected(selection, d));
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

async function main() {
  const data = await loadData();
  commits = processCommits(data);
  renderCommitInfo(data, commits);
  renderScatterPlot(commits);
  renderSelectionCount([]);
  renderLanguageBreakdown([]);
}

main().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML(
    'beforeend',
    '<p style="padding: 1rem; color: #b91c1c;">The meta visualization could not be loaded.</p>',
  );
});
