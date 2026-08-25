/**
 * e2e-runner.js
 * Standalone Automated E2E Test Suite Runner
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App (transporter)
 */

import { colors } from './test-harness.js';
import { tier1Tests } from './tier1-feature-tests.js';
import { tier2Tests } from './tier2-boundary-tests.js';
import { tier3Tests } from './tier3-combination-tests.js';
import { tier4Tests } from './tier4-scenario-tests.js';
import { tier5Tests } from './tier5-adversarial-tests.js';
import { tier5Tests as tier5StressTests } from './tier5-adversarial-stress-tests.js';

async function runSuite(suiteName, tests, options = {}) {
  console.log(`\n${colors.bold}${colors.cyan}▶ RUNNING SUITE: ${suiteName}${colors.reset} (${tests.length} tests)`);
  console.log(`${colors.gray}${'='.repeat(72)}${colors.reset}`);

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const test of tests) {
    if (options.grep && !test.name.includes(options.grep) && !test.id.includes(options.grep)) {
      continue;
    }

    const startTime = performance.now();
    try {
      await test.fn();
      const elapsed = (performance.now() - startTime).toFixed(1);
      passed++;
      const categoryTag = test.feature || test.category || test.combinationDesc || test.scenarioDesc || '';
      console.log(
        `  ${colors.green}✔ PASS${colors.reset} [${test.id}] ${colors.white}${test.name}${colors.reset} ` +
        `${colors.gray}(${elapsed}ms)${colors.reset} ${colors.dim}${categoryTag ? `[${categoryTag}]` : ''}${colors.reset}`
      );
    } catch (err) {
      const elapsed = (performance.now() - startTime).toFixed(1);
      failed++;
      failures.push({ test, err, elapsed });
      console.log(
        `  ${colors.red}✖ FAIL${colors.reset} [${test.id}] ${colors.bold}${test.name}${colors.reset} ` +
        `${colors.red}(${elapsed}ms)${colors.reset}`
      );
      if (options.verbose || true) {
        console.log(`    ${colors.red}${err.message || err}${colors.reset}`);
        if (err.stack && options.verbose) {
          console.log(`    ${colors.gray}${err.stack}${colors.reset}`);
        }
      }
    }
  }

  return { suiteName, total: tests.length, passed, failed, failures };
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    grep: args.find(a => a.startsWith('--grep='))?.split('=')[1],
    tier: args.find(a => a.startsWith('--tier='))?.split('=')[1],
  };

  const suiteStartTime = performance.now();

  console.log(`\n${colors.bold}${colors.blue}╔══════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}║   YOKOHAMA CITY BUS TRANSIT GUIDE - AUTOMATED E2E TEST RUNNER        ║${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}╚══════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.gray}Environment: Node.js ${process.version} | Target: Yokohama Municipal Bus PWA${colors.reset}`);

  const suitesToRun = [];

  if (!options.tier || options.tier === '1') {
    suitesToRun.push({ name: 'Tier 1: Feature Coverage', tests: tier1Tests });
  }
  if (!options.tier || options.tier === '2') {
    suitesToRun.push({ name: 'Tier 2: Boundary & Corner Cases', tests: tier2Tests });
  }
  if (!options.tier || options.tier === '3') {
    suitesToRun.push({ name: 'Tier 3: Cross-Feature Combinations', tests: tier3Tests });
  }
  if (!options.tier || options.tier === '4') {
    suitesToRun.push({ name: 'Tier 4: Real-World Scenarios', tests: tier4Tests });
  }
  if (!options.tier || options.tier === '5') {
    suitesToRun.push({ name: 'Tier 5 (Part A): DOM Lifecycle & AC Verification', tests: tier5Tests });
    suitesToRun.push({ name: 'Tier 5 (Part B): Adversarial Stress & Fuzzing', tests: tier5StressTests });
  }

  const results = [];
  for (const s of suitesToRun) {
    const res = await runSuite(s.name, s.tests, options);
    results.push(res);
  }

  const totalElapsed = (performance.now() - suiteStartTime).toFixed(1);
  const totalTests = results.reduce((acc, r) => acc + r.total, 0);
  const totalPassed = results.reduce((acc, r) => acc + r.passed, 0);
  const totalFailed = results.reduce((acc, r) => acc + r.failed, 0);
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';

  console.log(`\n${colors.bold}${colors.white}${'='.repeat(72)}${colors.reset}`);
  console.log(`${colors.bold}${colors.white}                    TEST SUITE EXECUTION SUMMARY                        ${colors.reset}`);
  console.log(`${colors.bold}${colors.white}${'='.repeat(72)}${colors.reset}`);

  for (const r of results) {
    const statusColor = r.failed === 0 ? colors.green : colors.red;
    const icon = r.failed === 0 ? '✔' : '✖';
    console.log(
      `  ${icon} ${colors.bold}${r.suiteName.padEnd(36)}${colors.reset}: ` +
      `${statusColor}${r.passed}/${r.total} passed${colors.reset} ` +
      `(${r.failed} failed)`
    );
  }

  console.log(`${colors.gray}${'-'.repeat(72)}${colors.reset}`);
  console.log(
    `  ${colors.bold}Total Test Cases : ${totalTests}${colors.reset}\n` +
    `  ${colors.green}Passed           : ${totalPassed}${colors.reset}\n` +
    `  ${totalFailed > 0 ? colors.red : colors.gray}Failed           : ${totalFailed}${colors.reset}\n` +
    `  ${colors.cyan}Pass Rate        : ${passRate}%${colors.reset}\n` +
    `  ${colors.gray}Total Time       : ${totalElapsed}ms${colors.reset}`
  );
  console.log(`${colors.bold}${colors.white}${'='.repeat(72)}${colors.reset}`);

  if (totalFailed > 0) {
    console.log(`\n${colors.bold}${colors.red}❌ FAILED: ${totalFailed} test(s) failed.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}✨ SUCCESS: All ${totalPassed} tests passed successfully!${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`${colors.bgRed}${colors.white} UNCAUGHT RUNNER ERROR ${colors.reset}`, err);
  process.exit(1);
});
