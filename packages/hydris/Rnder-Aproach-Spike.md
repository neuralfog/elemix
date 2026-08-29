# Render Approach Spike 🔬 Science time !

Bun vs QuickJs

`wrk -t12 -c400` against `/test-render`

| Stage | req/s | render overhead |
| --- | --- | --- |
| QuickJS fresh-context | 153k | — |
| QuickJS persistent context | 470k | ~200k |
| QuickJS compile-once | 565k | ~105k |
| QuickJS bytes-direct | 610k | ~60k |
| framework ceiling (no render) | 670k | 0 |

## Head to head

`wrk -t12 -c400 -d10s /test-render`, both measured on the same box.

| | req/s | avg latency | processes | memory |
| --- | --- | --- | --- | --- |
| Bun sidecar | 296k | 1.41 ms | 8 (+ 64 conns, IPC) | ~366 MB RSS (46 MB each) |
| QuickJS embedded | 610k | 0.69 ms | 1 (in-process) | ~3.4 MB heap |

**~2x the throughput, ~half the latency, ~1/100th the memory.**

Memory is measured, not estimated:

- **Bun**: `Process.WorkingSet64` summed over the 8 sidecar processes, sampled while live under load; it climbs then settles at ~366 MB (~46 MB each).
- **QuickJS**: `JS_ComputeMemoryUsage` = **103 KB per engine**; the pool self-bounds to ~33 engines under `-c400` (concurrency, not connection count), so ~3.4 MB total at peak.

The metrics differ in kind (bun = full process RSS across 8 processes; QuickJS = JS heap inside the one host process), so the real gap in favour of QuickJS is if anything understated.
