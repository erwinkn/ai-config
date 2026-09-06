(() => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const defaultColors = {
    entry: "rgba(41, 98, 255, 1)",
    breakout: "rgba(245, 124, 0, 1)",
    risk: "rgba(249, 168, 37, 1)",
    invalid: "rgba(211, 47, 47, 1)",
    target: "rgba(0, 137, 123, 1)",
    context: "rgba(123, 31, 162, 1)",
  };

  const state = {
    base: null,
    seedId: null,
  };

  function widget() {
    const value = window._exposed_chartWidgetCollection?.activeChartWidget?._value;
    if (!value) throw new Error("TradingView chart widget is not available");
    return value;
  }

  function horizontalLines(model) {
    return model.dataSources().filter((source) => source.toolname === "LineToolHorzLine");
  }

  function exactMatch(source, item) {
    const point = source.points?.()[0];
    const text = source.properties().state().text;
    return Math.abs((point?.price ?? Number.POSITIVE_INFINITY) - item.price) < 1e-8 && text === item.text;
  }

  function validateJobs(jobs) {
    if (!Array.isArray(jobs)) throw new Error("jobs must be an array");
    for (const job of jobs) {
      if (!job?.symbol || !Array.isArray(job.levels)) throw new Error("Each job needs symbol and levels");
      for (const item of job.levels) {
        if (!Number.isFinite(item?.price) || typeof item.text !== "string" || item.text.length === 0) {
          throw new Error(`Invalid level in ${job.symbol}`);
        }
      }
    }
  }

  async function prepare(options = {}) {
    const chart = widget();
    if (options.seedSymbol) {
      chart.setSymbol(options.seedSymbol);
      await sleep(options.loadWaitMs ?? 2600);
    }

    const model = chart.model();
    const lines = horizontalLines(model);
    const prefix = options.seedTextPrefix;
    const seed =
      (prefix
        ? lines.find((source) => source.properties().state().text.startsWith(prefix))
        : null) ?? lines[0];

    if (!seed) {
      throw new Error("No horizontal line is available as a property template");
    }

    state.base = seed.properties().clone();
    state.seedId = seed.id();
    return {
      ready: true,
      seedId: state.seedId,
      seedSymbol: seed.properties().state().symbol,
    };
  }

  async function applyJob(job, options = {}) {
    validateJobs([job]);
    if (options.ownedPrefix && job.levels.some((item) => !item.text.startsWith(options.ownedPrefix))) {
      throw new Error(`Every label in ${job.symbol} must start with ${options.ownedPrefix}`);
    }
    if (!state.base) await prepare(options);

    const chart = widget();
    chart.setSymbol(job.symbol);
    await sleep(options.loadWaitMs ?? 2600);

    const model = chart.model();
    const pane = model.panes()[0];
    const made = [];
    const skipped = [];

    for (const item of job.levels) {
      const lines = horizontalLines(model);
      if (lines.some((source) => exactMatch(source, item))) {
        skipped.push(`${item.text} @ ${item.price}`);
        continue;
      }

      const color = (options.colors ?? defaultColors)[item.kind] ?? defaultColors.context;
      const properties = state.base.clone();
      properties.merge({
        symbol: job.symbol,
        interval: model.mainSeries().interval(),
        linecolor: color,
        textcolor: color,
        linewidth: item.kind === "invalid" ? 3 : 2,
        linestyle: item.kind === "context" ? 2 : 0,
        showPrice: true,
        fontsize: 12,
        bold: true,
        italic: false,
        horzLabelsAlign: "right",
        vertLabelsAlign: "middle",
        text: item.text,
        ...(item.style ?? {}),
      });

      const source = model.createLineTool({
        pane,
        point: { index: 0, price: item.price },
        linetool: "LineToolHorzLine",
        properties,
      });
      made.push({ id: source.id(), text: item.text, price: item.price });
    }

    await sleep(options.saveWaitMs ?? 3300);
    const saved = job.levels.filter((item) =>
      horizontalLines(model).some((source) => exactMatch(source, item)),
    ).length;

    return {
      symbol: job.symbol,
      resolved: model.mainSeries().symbolInfo()?.full_name,
      expected: job.levels.length,
      saved,
      made: made.length,
      skipped: skipped.length,
    };
  }

  async function applyJobs(jobs, options = {}) {
    validateJobs(jobs);
    const start = options.start ?? 0;
    const end = options.end ?? jobs.length;
    const results = [];
    for (const job of jobs.slice(start, end)) results.push(await applyJob(job, options));
    return results;
  }

  async function verifyJob(job, options = {}) {
    validateJobs([job]);
    const chart = widget();
    chart.setSymbol(job.symbol);
    await sleep(options.verifyWaitMs ?? 2200);

    const model = chart.model();
    const lines = horizontalLines(model);
    const missing = job.levels.filter((item) => !lines.some((source) => exactMatch(source, item)));
    const wrongSymbols = lines
      .filter((source) => job.levels.some((item) => exactMatch(source, item)))
      .filter((source) => source.properties().state().symbol !== job.symbol)
      .map((source) => ({
        text: source.properties().state().text,
        price: source.points()[0].price,
        symbol: source.properties().state().symbol,
      }));

    return {
      symbol: job.symbol,
      expected: job.levels.length,
      found: job.levels.length - missing.length,
      missing,
      wrongSymbols,
    };
  }

  async function verifyJobs(jobs, options = {}) {
    validateJobs(jobs);
    const start = options.start ?? 0;
    const end = options.end ?? jobs.length;
    const results = [];
    for (const job of jobs.slice(start, end)) results.push(await verifyJob(job, options));
    return results;
  }

  window.CodexTradingViewLevels = {
    applyJob,
    applyJobs,
    prepare,
    verifyJob,
    verifyJobs,
    validateJobs,
    defaultColors: { ...defaultColors },
  };

  return { ready: true };
})();
