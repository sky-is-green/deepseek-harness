"""
Dual-host probe — Windows vs Linux tok/s + model-found end-to-end.
Run: python hivebench/experiments/dual_host_probe.py
"""
import os
import glob
import tempfile

def detect_model_bootstrap_target(models_dir):
    pattern = os.path.join(models_dir, "**", "*.gguf")
    found = glob.glob(pattern, recursive=True)
    if not found:
        raise FileNotFoundError(f"Missing weights in {models_dir}")
    shards = [f for f in found if "-00001-of-" in f]
    if shards:
        shards.sort()
        return shards[0]
    return found[0]

def calculate_tier(context_tokens, dual):
    MODEL_GB = 104.0
    VRAM = 40.0 if dual else 20.0
    WSL = 24.0
    KV = context_tokens * (0.07 / 1024.0)
    tier1 = min(MODEL_GB, VRAM)
    rem = MODEL_GB - tier1
    ram_w = min(rem, WSL)
    w_nvme = rem - ram_w
    ram_left = WSL - ram_w
    ram_kv = min(KV, max(0, ram_left))
    kv_nvme = KV - ram_kv
    tier3 = w_nvme + kv_nvme
    return {"tier1": tier1, "tier3": tier3, "total": MODEL_GB + KV, "io_warning": tier3 > 0 or context_tokens > 128_000}

def test():
    # Model-found: simulate Windows E:\models and Linux /mnt/dsh_storage/models with temp shards
    with tempfile.TemporaryDirectory() as win_dir, tempfile.TemporaryDirectory() as lin_dir:
        # Windows shards
        win_shard = os.path.join(win_dir, "model-00001-of-00002.gguf")
        open(win_shard, "w").close()
        open(os.path.join(win_dir, "model-00002-of-00002.gguf"), "w").close()
        assert detect_model_bootstrap_target(win_dir) == win_shard, "windows shard not found"
        # Linux shards
        lin_shard = os.path.join(lin_dir, "model-00001-of-00002.gguf")
        open(lin_shard, "w").close()
        open(os.path.join(lin_dir, "model-00002-of-00002.gguf"), "w").close()
        assert detect_model_bootstrap_target(lin_dir) == lin_shard, "linux shard not found"
        # Missing -> loud fail
        try:
            detect_model_bootstrap_target(os.path.join(tempfile.gettempdir(), "empty_nope_xyz"))
            raise AssertionError("should have thrown")
        except FileNotFoundError as e:
            assert "Missing weights" in str(e)

    # Tier vs tok/s: windows single vs linux dual
    for ctx in [32_768, 128_000]:
        win = calculate_tier(ctx, False)
        lin = calculate_tier(ctx, True)
        assert lin["tier1"] == 40 and win["tier1"] == 20, "VRAM tier mismatch"
        assert lin["tier3"] < win["tier3"], "dual should spill less to NVMe"
        # tok/s proxy: tier3 spill correlates with latency
        assert win["io_warning"] is True

    # 1M spills heavily on both, but dual less
    win_1m = calculate_tier(1_000_000, False)
    lin_1m = calculate_tier(1_000_000, True)
    assert win_1m["tier3"] > 100
    assert lin_1m["tier3"] > 90
    assert lin_1m["tier3"] < win_1m["tier3"]

    print("dual_host_probe: all checks pass")
    print(f"win 32k: {calculate_tier(32_768, False)}")
    print(f"lin 32k: {calculate_tier(32_768, True)}")
    print(f"win 1M: {win_1m}")
    print(f"lin 1M: {lin_1m}")

if __name__ == "__main__":
    test()
