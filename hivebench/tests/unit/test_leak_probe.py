import sys
sys.path.insert(0, ".")

from hivebench.experiments.leak_probe import is_reclaimed, detect_leak

def test_reclaimed():
    before = {"vramMb": 1000, "ramMb": 2000, "timestamp": 1}
    after = {"vramMb": 1020, "ramMb": 2050, "timestamp": 2}
    assert is_reclaimed(before, after) is True
    assert is_reclaimed(before, {"vramMb": 2000, "ramMb": 2000, "timestamp": 2}) is False

def test_detect_leak():
    h = [{"vramMb": 1000, "ramMb": 2000, "timestamp": 1}, {"vramMb": 1100, "ramMb": 2100, "timestamp": 2}, {"vramMb": 1200, "ramMb": 2200, "timestamp": 3}]
    assert detect_leak(h) is True
    ok = [{"vramMb": 1000, "ramMb": 2000, "timestamp": 1}, {"vramMb": 1010, "ramMb": 2010, "timestamp": 2}]
    assert detect_leak(ok) is False
