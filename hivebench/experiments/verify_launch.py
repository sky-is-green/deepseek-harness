"""
Verify launch link-up — automatable gate for DeepSeek-V4-Flash on VHDX + Docker.
Exit 0 when linked, 1 with actionable fix when not.
Run: python hivebench/experiments/verify_launch.py
"""
import os
import glob
import sys

VHDX = os.environ.get("VHDX_PATH", r"E:\dsh_storage.vhdx")
MOUNT = "/mnt/dsh_storage"
MODEL_DIR = f"{MOUNT}/models/DeepSeek-V4-Flash-0731-GGUF"
DOCKER_HEALTH = "http://127.0.0.1:8000/health"
DOCKER_MODELS = "http://127.0.0.1:8000/v1/models"

def check_vhdx():
    if not os.path.exists(VHDX):
        return False, f"VHDX not found ({VHDX}) — fix: create {VHDX} or set VHDX_PATH"
    return True, "VHDX ok"

def check_mount():
    # Try WSL mount check first (works from Windows host), fallback to /proc/mounts
    try:
        import subprocess
        out = subprocess.check_output(["wsl", "-d", "Ubuntu", "-e", "mount"], text=True)
        if MOUNT in out:
            return True, "mount ok"
        return False, f"not mounted ({MOUNT}) — fix: wsl --mount --vhd {VHDX} --bare && mount /dev/sdX1 {MOUNT}"
    except Exception:
        try:
            with open("/proc/mounts", "r", encoding="utf-8") as f:
                if MOUNT in f.read():
                    return True, "mount ok"
            return False, f"not mounted ({MOUNT}) — fix: wsl --mount --vhd {VHDX} --bare && mount /dev/sdX1 {MOUNT}"
        except FileNotFoundError:
            return False, f"not in WSL — fix: wsl -d Ubuntu -e mount | grep {MOUNT}"

def check_shards():
    pattern = f"{MODEL_DIR}/*-00001-of-*.gguf"
    found = glob.glob(pattern)
    if not found:
        # Windows host cannot read ext4 VHDX directly — check via WSL
        try:
            import subprocess
            out = subprocess.check_output(["wsl", "-d", "Ubuntu", "-e", "bash", "-c", f"ls {MODEL_DIR}/*-00001-of-*.gguf 2>&1"], text=True)
            if "00001-of-" in out:
                return True, f"shards ok ({out.strip().splitlines()[0]})"
        except Exception:
            pass
        win_pattern = r"E:\dsh_storage\models\DeepSeek-V4-Flash-0731-GGUF\*-00001-of-*.gguf"
        found = glob.glob(win_pattern)
    if found:
        return True, f"shards ok ({found[0]})"
    return False, f"model not found ({MODEL_DIR}/*-00001-of-*.gguf) — fix: ensure 4 shards at {MODEL_DIR}"

def check_docker_health():
    try:
        import urllib.request
        with urllib.request.urlopen(DOCKER_HEALTH, timeout=2) as r:
            if r.status == 200:
                return True, "docker health ok"
    except Exception as e:
        return False, f"docker health failed ({DOCKER_HEALTH}) — fix: docker ps | grep dsh-compute-backend; docker logs dsh-compute-backend — {e}"
    return False, "docker health unknown"

def check_models_api():
    try:
        import urllib.request, json
        with urllib.request.urlopen(DOCKER_MODELS, timeout=2) as r:
            data = json.loads(r.read().decode())
            text = str(data)
            if "DeepSeek" in text:
                return True, "models api ok"
            return False, f"models api missing DeepSeek — got {text[:200]} — fix: check MODEL_WORKSPACE_PATH"
    except Exception as e:
        return False, f"models api failed ({DOCKER_MODELS}) — fix: curl http://127.0.0.1:8000/v1/models — {e}"

def check_tier():
    # Reuse estimator: 32k single should not be disk full
    MODEL_GB = 104.0
    VRAM = 20.0
    WSL = 24.0
    KV = 32_768 * (0.07 / 1024.0)
    tier1 = min(MODEL_GB, VRAM)
    rem = MODEL_GB - tier1
    ram_w = min(rem, WSL)
    tier3 = (rem - ram_w) + (KV - min(KV, max(0, WSL - ram_w)))
    # Assume 1TB NVMe, 0 used
    if tier3 > 1000 * 0.8:
        return False, f"disk full tier3 {tier3:.1f} > 800 — fix: free E:\\"
    return True, f"tier ok tier3 {tier3:.1f}GB"

def main():
    checks = [
        ("VHDX", check_vhdx),
        ("Mount", check_mount),
        ("Shards", check_shards),
        ("Docker health", check_docker_health),
        ("Models API", check_models_api),
        ("Tier", check_tier),
    ]
    ok_all = True
    for name, fn in checks:
        ok, msg = fn()
        icon = "OK" if ok else "FAIL"
        print(f"{icon} {name}: {msg}")
        if not ok:
            ok_all = False
    if ok_all:
        print("verify_launch: LINKED — ready to launch DeepSeek-V4-Flash")
        sys.exit(0)
    else:
        print("verify_launch: NOT LINKED — fix above, then re-run")
        sys.exit(1)

if __name__ == "__main__":
    main()
