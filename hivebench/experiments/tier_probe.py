"""
Tier probe — validates FP8 KV estimator + 32k-128k cap + disk guard.
Run: python hivebench/experiments/tier_probe.py
"""
import sys
sys.path.insert(0, ".")

def calculate_hardware_allocation(context_tokens: int, dual_gpu_mode: bool = False, nvme_capacity_gb: float = 1000, nvme_used_gb: float = 0):
    MODEL_GB = 104.0
    VRAM = 40.0 if dual_gpu_mode else 20.0
    WSL_RAM = 24.0
    KV_PER_TOKEN = 0.07 / 1024.0
    kv = context_tokens * KV_PER_TOKEN
    tier1 = min(MODEL_GB, VRAM)
    remaining = MODEL_GB - tier1
    ram_weights = min(remaining, WSL_RAM)
    weights_nvme = remaining - ram_weights
    ram_left = WSL_RAM - ram_weights
    ram_kv = min(kv, max(0, ram_left))
    kv_nvme = kv - ram_kv
    tier3 = weights_nvme + kv_nvme
    tier2 = ram_weights + ram_kv
    total = MODEL_GB + kv
    io_warning = kv > 0 and (tier3 > 0 or context_tokens > 128_000)
    disk_full = tier3 + nvme_used_gb > nvme_capacity_gb * 0.8
    return {
        "metrics": {"total": round(total,2), "tier1": round(tier1,2), "tier2": round(tier2,2), "tier3": round(tier3,2)},
        "flags": {"io_latency_warning": io_warning, "disk_full": disk_full, "recommend_cap": 131072 if dual_gpu_mode else 32768}
    }

def test():
    # 32k single fits without disk full
    r = calculate_hardware_allocation(32_768, False)
    assert r["flags"]["disk_full"] is False, "32k should not be disk full"
    assert r["metrics"]["tier3"] > 0, "weights spill to NVMe"
    # 128k io warning
    r2 = calculate_hardware_allocation(128_000, False)
    assert r2["flags"]["io_latency_warning"] is True
    # 1M single spills heavily
    r3 = calculate_hardware_allocation(1_000_000, False)
    assert r3["metrics"]["tier3"] > 100, f"1M tier3 {r3['metrics']['tier3']}"
    assert r3["flags"]["io_latency_warning"] is True
    # dual has larger VRAM
    single = calculate_hardware_allocation(32_768, False)
    dual = calculate_hardware_allocation(32_768, True)
    assert dual["metrics"]["tier1"] == 40
    assert single["metrics"]["tier1"] == 20
    assert dual["flags"]["recommend_cap"] == 131072
    # disk full blocks
    r4 = calculate_hardware_allocation(32_768, False, nvme_capacity_gb=100, nvme_used_gb=90)
    assert r4["flags"]["disk_full"] is True, "should be disk full >80%"
    print("tier_probe: all checks pass")
    for ctx in [32_768, 128_000, 1_000_000]:
        for dual in [False, True]:
            r = calculate_hardware_allocation(ctx, dual)
            print(f"ctx={ctx} dual={dual} -> {r['metrics']} flags={r['flags']}")

if __name__ == "__main__":
    test()
