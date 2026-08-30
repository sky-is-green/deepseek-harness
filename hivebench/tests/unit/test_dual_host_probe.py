import tempfile
import os
import sys
sys.path.insert(0, ".")

from hivebench.experiments.dual_host_probe import detect_model_bootstrap_target, calculate_tier

def test_model_found_windows_linux():
    with tempfile.TemporaryDirectory() as win_dir, tempfile.TemporaryDirectory() as lin_dir:
        win_shard = os.path.join(win_dir, "model-00001-of-00002.gguf")
        open(win_shard, "w").close()
        open(os.path.join(win_dir, "model-00002-of-00002.gguf"), "w").close()
        assert detect_model_bootstrap_target(win_dir) == win_shard
        lin_shard = os.path.join(lin_dir, "model-00001-of-00002.gguf")
        open(lin_shard, "w").close()
        assert detect_model_bootstrap_target(lin_dir) == lin_shard

def test_tier_dual_less_spill():
    win = calculate_tier(32_768, False)
    lin = calculate_tier(32_768, True)
    assert lin["tier1"] == 40
    assert win["tier1"] == 20
    assert lin["tier3"] < win["tier3"]

def test_1m_heavy_spill():
    win = calculate_tier(1_000_000, False)
    assert win["tier3"] > 100
