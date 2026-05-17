Load Testing Guidance
======================

Use `autocannon` or `k6` to run lightweight load tests locally.

Example using `autocannon` (install globally: `npm i -g autocannon`):

  # 10 concurrent connections for 30s against API health
  autocannon -c 10 -d 30 http://localhost:4000/health

Example using `k6` (recommended for more advanced tests):

  # install k6: https://k6.io/docs/getting-started/installation
  k6 run -u 50 -d 30s script.js

Interpretation:
- Check p95 latency, error rates, and throughput. Look for response codes and increased error counts during load.
