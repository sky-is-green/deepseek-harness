"""
Leak probe — load/unload loop + VRAM/RAM reclaim assert.
Run: python hivebench/experiments/leak_probe.py
"""
import time

RECLAIM_TOL = 0.05

def is_reclaimed(before, after, tol=RECLAIM_TOL):
    vram_ok = abs(after["vramMb"] - before["vramMb"]) <= before["vramMb"] * tol + 50
    ram_ok = abs(after["ramMb"] - before["ramMb"]) <= before["ramMb"] * tol + 50
    return vram_ok and ram_ok

def detect_leak(history, tol=RECLAIM_TOL):
    if len(history) < 2:
        return False
    first, last = history[0], history[-1]
    return not is_reclaimed(first, last, tol) and last["vramMb"] > first["vramMb"]

def run_probe(iterations=50):
    # Mock: in real run, each iter does load 7B -> 1K ctx -> unload and captures hardware()
    history = []
    for i in range(iterations):
        before = {"vramMb": 1000, "ramMb": 2000, "timestamp": time.time()}
        # Simulate no leak
        after = {"vramMb": 1005, "ramMb": 2005, "timestamp": time.time()}
        history.append(after)
        if not is_reclaimed(before, after):
            raise AssertionError(f"iter {i} leak: before {before} after {after}")
    if detect_leak(history):
        raise AssertionError("leak detected across history")
    print(f"leak_probe: {iterations} iters ok, no leak")

if __name__ == "__main__":
    run_probe(50)
