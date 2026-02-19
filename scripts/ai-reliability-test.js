#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { runReliabilitySuite } = require('../backend/src/ai/reliability.test');

const parseArgs = (argv) => {
  const options = {
    batchSize: 200,
    uniquePool: 40,
    concurrency: 50,
    dryRun: false,
    json: false,
    reportFile: null,
    baselineFile: null,
    updateBaseline: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--batch' && argv[i + 1]) {
      options.batchSize = Number(argv[++i]);
    } else if (arg === '--unique' && argv[i + 1]) {
      options.uniquePool = Number(argv[++i]);
    } else if (arg === '--concurrency' && argv[i + 1]) {
      options.concurrency = Number(argv[++i]);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--report' && argv[i + 1]) {
      options.reportFile = argv[++i];
    } else if (arg === '--baseline' && argv[i + 1]) {
      options.baselineFile = argv[++i];
    } else if (arg === '--update-baseline') {
      options.updateBaseline = true;
    }
  }

  return options;
};

const loadBaseline = (baselineFile) => {
  if (!baselineFile) {
    return null;
  }

  const resolved = path.resolve(process.cwd(), baselineFile);
  if (!fs.existsSync(resolved)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch {
    return null;
  }
};

const buildBaselineFromReport = (report) => ({
  translationAvgLatencyMs: report.metrics.translation.avgLatencyMs,
  translationCacheHitRate: report.metrics.telemetry.translation.cacheHitRate,
  summaryAvgQuality: report.metrics.summarization.averageQualityScore,
  recordedAt: new Date().toISOString()
});

const renderTextReport = (report) => {
  const lines = [];

  lines.push('AI Reliability Report');
  lines.push('=====================');
  lines.push(`Status: ${report.status.toUpperCase()}`);
  lines.push(`Started: ${report.startedAt}`);
  lines.push(`Finished: ${report.finishedAt}`);
  lines.push('');

  lines.push('Assertions');
  lines.push(`- Total: ${report.assertions.total}`);
  lines.push(`- Passed: ${report.assertions.passed}`);
  lines.push(`- Failed: ${report.assertions.failed}`);
  lines.push('');

  lines.push('Metrics');
  lines.push(`- Translation avg latency: ${report.metrics.translation.avgLatencyMs} ms`);
  lines.push(`- Translation p95 latency: ${report.metrics.translation.p95LatencyMs} ms`);
  lines.push(`- Summary avg latency: ${report.metrics.summarization.avgLatencyMs} ms`);
  lines.push(`- Summary avg quality: ${report.metrics.summarization.averageQualityScore}`);
  lines.push(`- Telemetry translation cache hit rate: ${report.metrics.telemetry.translation.cacheHitRate}`);
  lines.push(`- Telemetry translation error rate: ${report.metrics.telemetry.translation.errorRate}`);
  lines.push(`- Telemetry summary error rate: ${report.metrics.telemetry.summarization.errorRate}`);
  lines.push(`- Gemini usage count: ${report.metrics.telemetry.summarization.geminiUsage}`);
  lines.push(`- Fallback usage rate: ${report.metrics.telemetry.translation.fallbackRate}`);
  lines.push('');

  if (report.regressions.length > 0) {
    lines.push('Regressions');
    report.regressions.forEach((regression) => {
      lines.push(`- ${regression.metric}: baseline=${regression.baseline}, current=${regression.current}`);
    });
    lines.push('');
  }

  if (report.metrics.telemetry.alerts.length > 0) {
    lines.push('Alerts');
    report.metrics.telemetry.alerts.slice(-5).forEach((alert) => {
      lines.push(`- [${alert.metric}] ${alert.message} (${alert.value} vs ${alert.threshold})`);
    });
    lines.push('');
  }

  return lines.join('\n');
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const baseline = loadBaseline(args.baselineFile);

  const report = await runReliabilitySuite({
    batchSize: args.batchSize,
    uniquePool: args.uniquePool,
    concurrency: args.concurrency,
    dryRun: args.dryRun,
    baseline
  });

  if (args.reportFile) {
    const reportPath = path.resolve(process.cwd(), args.reportFile);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  if (args.updateBaseline && args.baselineFile) {
    const baselinePath = path.resolve(process.cwd(), args.baselineFile);
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.writeFileSync(baselinePath, JSON.stringify(buildBaselineFromReport(report), null, 2));
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderTextReport(report)}\n`);
  }

  process.exit(report.status === 'pass' ? 0 : 1);
};

main().catch((error) => {
  process.stderr.write(`AI reliability run failed: ${error.message}\n`);
  process.exit(1);
});
