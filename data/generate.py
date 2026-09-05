"""
Abuse-Ring Sentinel — Synthetic Dataset Generator
Generates 300-500 accounts with planted abuse rings and innocent households.
"""

import json
import random
import string
import uuid
import os
from datetime import datetime, timedelta
from pathlib import Path


# ── helpers ──────────────────────────────────────────────────────────────────

def _rand_name():
    first = random.choice([
        "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh",
        "Ayaan", "Krishna", "Ishaan", "Ananya", "Diya", "Priya", "Meera",
        "Kavya", "Riya", "Neha", "Shreya", "Tanvi", "Pooja", "Rahul",
        "Amit", "Sanjay", "Deepak", "Vikram", "Suresh", "Mohan", "Kiran",
        "Nisha", "Sunita", "Raj", "Dev", "Aryan", "Kabir", "Rohan",
    ])
    last = random.choice([
        "Sharma", "Verma", "Gupta", "Singh", "Kumar", "Patel", "Reddy",
        "Nair", "Iyer", "Joshi", "Chopra", "Mehta", "Shah", "Rao",
        "Kapoor", "Malhotra", "Bose", "Das", "Chauhan", "Thakur",
    ])
    return f"{first} {last}"


def _rand_device():
    return f"dev-{uuid.uuid4().hex[:12]}"


def _rand_ip():
    return f"{random.randint(1,223)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"


def _rand_payment():
    return f"pay-{''.join(random.choices(string.ascii_lowercase + string.digits, k=14))}"


def _rand_address():
    num = random.randint(1, 999)
    street = random.choice([
        "MG Road", "Brigade Road", "Park Street", "Ring Road", "Station Road",
        "Gandhi Nagar", "Nehru Place", "Rajaji Street", "Anna Salai",
        "Connaught Place", "Lajpat Nagar", "Indiranagar", "Koramangala",
        "Banjara Hills", "Jubilee Hills", "Salt Lake", "New Town",
    ])
    city = random.choice([
        "Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad",
        "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Lucknow",
    ])
    return f"{num}, {street}, {city}"


def _rand_promo():
    codes = [
        "WELCOME50", "REFER10", "NEWUSER", "CASHBACK20", "FESTIVE100",
        "DIWALI25", "SUMMER30", "FIRST50", "LOYALTY15", "MEGADEAL",
        "FLAT200", "SPECIAL99", "SAVE40", "BONUS75", "REWARD60",
    ]
    return random.choice(codes)


def _rand_ts(base: datetime, spread_minutes: int = 30):
    """Return a timestamp clustered near `base`."""
    offset = random.gauss(0, spread_minutes)
    return base + timedelta(minutes=offset)


def _rand_ts_spread(base: datetime, spread_days: int = 60):
    """Return a timestamp spread across weeks (for innocent households)."""
    offset = random.uniform(-spread_days, spread_days)
    return base + timedelta(days=offset)


# ── generators ───────────────────────────────────────────────────────────────

def _generate_abuse_ring(ring_id: str, size: int, base_time: datetime):
    """Generate a ring of accounts that share 2-3 identifiers + tight timing."""
    accounts = []
    ground_truth = {}

    # Choose which identifiers this ring shares (2-3 of: device, payment, ip, address)
    shareable = ["device_id", "payment_id", "ip", "address"]
    num_shared = random.choice([2, 3])
    shared_attrs = random.sample(shareable, num_shared)

    # Generate shared values
    shared_vals = {}
    if "device_id" in shared_attrs:
        shared_vals["device_id"] = _rand_device()
    if "payment_id" in shared_attrs:
        shared_vals["payment_id"] = _rand_payment()
    if "ip" in shared_attrs:
        shared_vals["ip"] = _rand_ip()
    if "address" in shared_attrs:
        shared_vals["address"] = _rand_address()

    # Shared promo code for the ring (high probability)
    ring_promo = _rand_promo()

    # One member index that will evade on device_id
    evader_idx = random.randint(0, size - 1)

    for i in range(size):
        acc_id = f"acc-{uuid.uuid4().hex[:10]}"
        acc = {
            "id": acc_id,
            "name": _rand_name(),
            "device_id": shared_vals.get("device_id", _rand_device()),
            "ip": shared_vals.get("ip", _rand_ip()),
            "payment_id": shared_vals.get("payment_id", _rand_payment()),
            "address": shared_vals.get("address", _rand_address()),
            "promo_code": ring_promo if random.random() < 0.85 else _rand_promo(),
            "signup_ts": _rand_ts(base_time, spread_minutes=45).isoformat(),
        }

        # Evasion: one member uses a different device
        if i == evader_idx and "device_id" in shared_attrs:
            acc["device_id"] = _rand_device()

        accounts.append(acc)
        ground_truth[acc_id] = ring_id

    return accounts, ground_truth


def _generate_innocent_household(cluster_id: str, size: int, base_time: datetime,
                                  hard_mode: bool = False):
    """
    Generate a household cluster sharing address + IP (same home router).
    With hard_mode, members also sign up within a few days (friend referral scenario)
    — these are the realistic false-positive traps.
    """
    accounts = []
    ground_truth = {}

    shared_address = _rand_address()
    shared_ip = _rand_ip()  # Same home router

    for _ in range(size):
        acc_id = f"acc-{uuid.uuid4().hex[:10]}"
        if hard_mode:
            # Tighter signup window (days, not months) — simulates family referral
            signup = _rand_ts(base_time, spread_minutes=60 * 24 * 3)  # ~3 days
        else:
            signup = _rand_ts_spread(base_time, spread_days=90)
        acc = {
            "id": acc_id,
            "name": _rand_name(),
            "device_id": _rand_device(),
            "ip": shared_ip,
            "payment_id": _rand_payment(),
            "address": shared_address,
            "promo_code": _rand_promo(),
            "signup_ts": signup.isoformat(),
        }
        accounts.append(acc)
        ground_truth[acc_id] = None  # NOT abuse

    return accounts, ground_truth


def _generate_noise(count: int, base_time: datetime):
    """Generate completely independent legitimate accounts."""
    accounts = []
    ground_truth = {}

    for _ in range(count):
        acc_id = f"acc-{uuid.uuid4().hex[:10]}"
        acc = {
            "id": acc_id,
            "name": _rand_name(),
            "device_id": _rand_device(),
            "ip": _rand_ip(),
            "payment_id": _rand_payment(),
            "address": _rand_address(),
            "promo_code": _rand_promo() if random.random() < 0.4 else None,
            "signup_ts": _rand_ts_spread(base_time, spread_days=180).isoformat(),
        }
        accounts.append(acc)
        ground_truth[acc_id] = None

    return accounts, ground_truth


# ── main generator ───────────────────────────────────────────────────────────

def generate_dataset(seed: int = None) -> dict:
    """
    Generate a full synthetic dataset.
    Returns { "accounts": [...], "ground_truth": {...}, "stats": {...} }.
    """
    if seed is not None:
        random.seed(seed)

    base_time = datetime(2025, 6, 15, 10, 0, 0)
    all_accounts = []
    all_ground_truth = {}

    # ── Abuse rings: 6-10 rings, 3-7 members each ──
    num_rings = random.randint(6, 10)
    ring_stats = []
    for i in range(num_rings):
        ring_id = f"ring-{i+1:02d}"
        ring_size = random.randint(3, 7)
        ring_base = base_time + timedelta(days=random.randint(0, 60))
        accs, gt = _generate_abuse_ring(ring_id, ring_size, ring_base)
        all_accounts.extend(accs)
        all_ground_truth.update(gt)
        ring_stats.append({"ring_id": ring_id, "size": ring_size})

    # ── Innocent households: 3-5 clusters, 2-4 members each ──
    num_households = random.randint(3, 5)
    household_stats = []
    for i in range(num_households):
        cluster_id = f"household-{i+1:02d}"
        cluster_size = random.randint(2, 4)
        cluster_base = base_time + timedelta(days=random.randint(0, 120))
        # First 2 households are "hard mode" — share IP + address + tighter timing
        hard = (i < 2)
        accs, gt = _generate_innocent_household(cluster_id, cluster_size, cluster_base, hard_mode=hard)
        all_accounts.extend(accs)
        all_ground_truth.update(gt)
        household_stats.append({"cluster_id": cluster_id, "size": cluster_size})

    # ── Noise: fill to 300-500 total ──
    current = len(all_accounts)
    target = random.randint(max(300, current + 50), 500)
    noise_count = target - current
    if noise_count > 0:
        accs, gt = _generate_noise(noise_count, base_time)
        all_accounts.extend(accs)
        all_ground_truth.update(gt)

    # Shuffle so rings aren't contiguous
    random.shuffle(all_accounts)

    stats = {
        "total_accounts": len(all_accounts),
        "num_rings": num_rings,
        "ring_details": ring_stats,
        "num_households": num_households,
        "household_details": household_stats,
        "noise_accounts": noise_count,
        "abuse_accounts": sum(1 for v in all_ground_truth.values() if v is not None),
        "innocent_accounts": sum(1 for v in all_ground_truth.values() if v is None),
    }

    return {
        "accounts": all_accounts,
        "ground_truth": all_ground_truth,
        "stats": stats,
    }


def save_dataset(output_dir: str = None, seed: int = None) -> dict:
    """Generate and save dataset to disk."""
    if output_dir is None:
        output_dir = str(Path(__file__).parent)

    dataset = generate_dataset(seed=seed)

    accounts_path = os.path.join(output_dir, "accounts.json")
    gt_path = os.path.join(output_dir, "ground_truth.json")
    stats_path = os.path.join(output_dir, "stats.json")

    with open(accounts_path, "w") as f:
        json.dump(dataset["accounts"], f, indent=2)
    with open(gt_path, "w") as f:
        json.dump(dataset["ground_truth"], f, indent=2)
    with open(stats_path, "w") as f:
        json.dump(dataset["stats"], f, indent=2)

    print(f"✓ Generated {dataset['stats']['total_accounts']} accounts")
    print(f"  • {dataset['stats']['num_rings']} abuse rings ({dataset['stats']['abuse_accounts']} accounts)")
    print(f"  • {dataset['stats']['num_households']} innocent households")
    print(f"  • {dataset['stats']['noise_accounts']} noise accounts")
    print(f"  Saved to: {output_dir}")

    return dataset["stats"]


if __name__ == "__main__":
    save_dataset(seed=42)
