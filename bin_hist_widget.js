(function () {
  // Prevent double-init if JupyterBook hot reloads / re-renders
  if (window.__BIN_HIST_WIDGET_INIT__) return;
  window.__BIN_HIST_WIDGET_INIT__ = true;

  const roundNice = (x) => {
    if (!isFinite(x)) return "";
    const ax = Math.abs(x);
    if (ax >= 100) return x.toFixed(0);
    if (ax >= 10) return x.toFixed(1);
    return x.toFixed(2);
  };

  const computeBinsByCount = (values, k) => {
    const v = [...values].sort((a, b) => a - b);
    const min = v[0], max = v[v.length - 1];
    const range = (max - min) || 1;
    const width = range / k;
    const edges = Array.from({ length: k + 1 }, (_, i) => min + i * width);
    const counts = Array.from({ length: k }, () => 0);
    for (const x of v) {
      let idx = Math.floor((x - min) / width);
      if (idx === k) idx = k - 1;
      counts[idx]++;
    }
    return { min, max, width, edges, counts };
  };

  const computeBinsByWidth = (values, width) => {
    const v = [...values].sort((a, b) => a - b);
    const min0 = v[0], max0 = v[v.length - 1];
    const w = width > 0 ? width : 1;
    const min = min0;
    const k = Math.max(1, Math.ceil((max0 - min) / w) || 1);
    const max = min + k * w;
    const edges = Array.from({ length: k + 1 }, (_, i) => min + i * w);
    const counts = Array.from({ length: k }, () => 0);
    for (const x of v) {
      let idx = Math.floor((x - min) / w);
      if (idx < 0) idx = 0;
      if (idx >= k) idx = k - 1;
      counts[idx]++;
    }
    return { min, max, width: w, edges, counts };
  };

  const mk = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag);

  function renderWidget(host) {
    if (host.dataset.initialized === "1") return;
    host.dataset.initialized = "1";

    let parsed;
    try {
      parsed = JSON.parse(host.getAttribute("data-data"));
    } catch (e) {
      host.textContent = "Histogram widget: could not parse data-data JSON.";
      return;
    }

    // Build DOM
    const card = document.createElement("div");
    card.className = "bin-hist-card";

    card.innerHTML = `
      <div class="bin-hist-controls">
        <div>
          <label>Variable</label>
          <select data-el="varSelect"></select>
        </div>
        <div>
          <label>Mode</label>
          <select data-el="modeSelect">
            <option value="count"># bins</option>
            <option value="width">bin width</option>
          </select>
        </div>
        <div style="min-width:280px;">
          <label><span data-el="sliderLabel"># bins</span>: <span data-el="sliderValue"></span></label>
          <input data-el="binSlider" type="range" min="2" max="20" step="1" value="6" style="width:100%;">
          <div style="font-size:12px; color:#555; margin-top:4px;">
            Try very few bins vs many bins. What patterns appear/disappear?
          </div>
        </div>
        <div class="bin-hist-meta">
          <div><b>N</b>: <span data-el="nVal"></span></div>
          <div><b>min</b>: <span data-el="minVal"></span> • <b>max</b>: <span data-el="maxVal"></span></div>
          <div><b>bin width</b>: <span data-el="bwVal"></span></div>
        </div>
      </div>
      <svg data-el="histSvg" class="bin-hist-svg" width="800" height="360"></svg>
      <div class="bin-hist-caption">
        <b>What to notice:</b> The same data can look very different depending on binning.
        Ask: which binning is “honest” vs “misleading” for this dataset?
      </div>
    `;

    host.appendChild(card);

    const $ = (name) => card.querySelector(`[data-el="${name}"]`);
    const varSelect = $("varSelect");
    const modeSelect = $("modeSelect");
    const binSlider = $("binSlider");
    const svg = $("histSvg");

    // Populate
    Object.keys(parsed).forEach((k) => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k;
      varSelect.appendChild(opt);
    });

    function clearSvg() { while (svg.firstChild) svg.removeChild(svg.firstChild); }

    function drawHistogram(values, binsObj, variableName) {
      clearSvg();

      const widthPx = Number(svg.getAttribute("width")) || 800;
      const heightPx = Number(svg.getAttribute("height")) || 360;

      const margin = { top: 18, right: 18, bottom: 52, left: 46 };
      const innerW = widthPx - margin.left - margin.right;
      const innerH = heightPx - margin.top - margin.bottom;

      const maxCount = Math.max(...binsObj.counts, 1);
      const x0 = margin.left;
      const y0 = margin.top + innerH;
      const barW = innerW / binsObj.counts.length;

      const yScale = (c) => innerH * (c / maxCount);

      // axes
      const yAxis = mk("line");
      yAxis.setAttribute("x1", x0); yAxis.setAttribute("x2", x0);
      yAxis.setAttribute("y1", margin.top); yAxis.setAttribute("y2", y0);
      yAxis.setAttribute("stroke", "#333");
      svg.appendChild(yAxis);

      const xAxis = mk("line");
      xAxis.setAttribute("x1", x0); xAxis.setAttribute("x2", x0 + innerW);
      xAxis.setAttribute("y1", y0); xAxis.setAttribute("y2", y0);
      xAxis.setAttribute("stroke", "#333");
      svg.appendChild(xAxis);

      // y grid + ticks
      const yTicks = 4;
      for (let i = 0; i <= yTicks; i++) {
        const val = Math.round((maxCount * i) / yTicks);
        const y = y0 - innerH * (i / yTicks);

        const grid = mk("line");
        grid.setAttribute("x1", x0);
        grid.setAttribute("x2", x0 + innerW);
        grid.setAttribute("y1", y);
        grid.setAttribute("y2", y);
        grid.setAttribute("stroke", "#eee");
        svg.appendChild(grid);

        const lbl = mk("text");
        lbl.setAttribute("x", x0 - 8);
        lbl.setAttribute("y", y + 4);
        lbl.setAttribute("text-anchor", "end");
        lbl.setAttribute("font-size", "12");
        lbl.setAttribute("fill", "#444");
        lbl.textContent = val;
        svg.appendChild(lbl);
      }

      // bars
      binsObj.counts.forEach((c, i) => {
        const h = yScale(c);
        const rect = mk("rect");
        rect.setAttribute("x", x0 + i * barW + 1);
        rect.setAttribute("y", y0 - h);
        rect.setAttribute("width", Math.max(0, barW - 2));
        rect.setAttribute("height", h);
        rect.setAttribute("fill", "#4C78A8");
        rect.setAttribute("opacity", "0.9");

        const title = mk("title");
        title.textContent = `Bin ${i + 1}: [${roundNice(binsObj.edges[i])}, ${roundNice(binsObj.edges[i + 1])})  count=${c}`;
        rect.appendChild(title);

        svg.appendChild(rect);
      });

      // x labels (few)
      const k = binsObj.counts.length;
      const tickCount = Math.min(6, k + 1);
      for (let t = 0; t < tickCount; t++) {
        const idx = Math.round((k * t) / (tickCount - 1));
        const x = x0 + (idx * barW);

        const tick = mk("line");
        tick.setAttribute("x1", x); tick.setAttribute("x2", x);
        tick.setAttribute("y1", y0); tick.setAttribute("y2", y0 + 6);
        tick.setAttribute("stroke", "#333");
        svg.appendChild(tick);

        const tx = mk("text");
        tx.setAttribute("x", x);
        tx.setAttribute("y", y0 + 22);
        tx.setAttribute("text-anchor", t === 0 ? "start" : (t === tickCount - 1 ? "end" : "middle"));
        tx.setAttribute("font-size", "12");
        tx.setAttribute("fill", "#444");
        tx.textContent = roundNice(binsObj.edges[idx]);
        svg.appendChild(tx);
      }

      // title
      const title = mk("text");
      title.setAttribute("x", margin.left);
      title.setAttribute("y", 16);
      title.setAttribute("font-size", "14");
      title.setAttribute("font-weight", "700");
      title.setAttribute("fill", "#111");
      title.textContent = `Histogram of ${variableName}`;
      svg.appendChild(title);

      // stats
      const sorted = [...values].sort((a, b) => a - b);
      $("nVal").textContent = values.length;
      $("minVal").textContent = roundNice(sorted[0]);
      $("maxVal").textContent = roundNice(sorted[sorted.length - 1]);
      $("bwVal").textContent = roundNice(binsObj.width);
    }

    function configureSlider(values) {
      const v = [...values].sort((a, b) => a - b);
      const min = v[0], max = v[v.length - 1];
      const range = (max - min) || 1;

      if (modeSelect.value === "count") {
        $("sliderLabel").textContent = "# bins";
        binSlider.min = 2;
        binSlider.max = 20;
        binSlider.step = 1;
        if (+binSlider.value < 2) binSlider.value = 6;
      } else {
        $("sliderLabel").textContent = "bin width";
        let step = range / 50;
        if (!isFinite(step) || step <= 0) step = 1;

        const pow10 = Math.pow(10, Math.floor(Math.log10(step)));
        const norm = step / pow10;
        let nice = 1;
        if (norm >= 5) nice = 5;
        else if (norm >= 2) nice = 2;
        else if (norm >= 1) nice = 1;
        else if (norm >= 0.5) nice = 0.5;
        else if (norm >= 0.2) nice = 0.2;
        else nice = 0.1;
        step = nice * pow10;

        const minW = Math.max(step, range / 40);
        const maxW = Math.max(minW + step, range / 2);

        binSlider.min = minW;
        binSlider.max = maxW;
        binSlider.step = step;
        binSlider.value = Math.min(maxW, Math.max(minW, range / 6));
      }
    }

    function render(reconfigure = true) {
      const variable = varSelect.value;
      const values = parsed[variable];

      if (reconfigure) configureSlider(values);

      let binsObj;
      if (modeSelect.value === "count") {
        const k = Math.round(+binSlider.value);
        $("sliderValue").textContent = k;
        binsObj = computeBinsByCount(values, k);
      } else {
        const w = +binSlider.value;
        $("sliderValue").textContent = roundNice(w);
        binsObj = computeBinsByWidth(values, w);
      }
      drawHistogram(values, binsObj, variable);
    }

    varSelect.addEventListener("change", () => render(true));
    modeSelect.addEventListener("change", () => render(true));
    binSlider.addEventListener("input", () => render(false));

    varSelect.value = "Temperature";
    render(true);
  }

  function initAll() {
    document.querySelectorAll(".bin-hist-widget").forEach(renderWidget);
  }

  // Run now + after DOM ready (covers various JupyterBook load orders)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
