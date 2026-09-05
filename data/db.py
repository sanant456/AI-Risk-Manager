"""
Abuse-Ring Sentinel — SQLite Persistent Database Module
Provides schema initialization, account persistence, cluster logging, and transaction querying.
"""

import sqlite3
import json
import os
from pathlib import Path

# Use /tmp directory on Vercel serverless / read-only filesystems
if os.environ.get("VERCEL") or not os.access(Path(__file__).parent, os.W_OK):
    DB_PATH = "/tmp/sentinel.db"
else:
    DB_PATH = os.path.join(Path(__file__).parent, "sentinel.db")



def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database tables for accounts, detection_runs, and clusters."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            device_id TEXT,
            ip TEXT,
            payment_id TEXT,
            address TEXT,
            promo_code TEXT,
            signup_ts TEXT,
            ground_truth_ring TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS detection_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            threshold REAL NOT NULL,
            precision REAL,
            recall REAL,
            f1 REAL,
            total_accounts INTEGER,
            num_flagged INTEGER,
            num_cleared INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS clusters (
            cluster_id TEXT PRIMARY KEY,
            run_id INTEGER,
            score REAL NOT NULL,
            group_size INTEGER NOT NULL,
            flagged BOOLEAN NOT NULL,
            reasons_json TEXT,
            members_json TEXT,
            FOREIGN KEY (run_id) REFERENCES detection_runs (id)
        );
    """)

    conn.commit()
    conn.close()


def save_dataset_to_db(accounts: list[dict], ground_truth: dict):
    """Persist loaded dataset into SQLite database."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM accounts")

    for acc in accounts:
        aid = acc["id"]
        cursor.execute("""
            INSERT OR REPLACE INTO accounts (id, name, device_id, ip, payment_id, address, promo_code, signup_ts, ground_truth_ring)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            aid,
            acc.get("name", f"Account {aid}"),
            acc.get("device_id"),
            acc.get("ip"),
            acc.get("payment_id"),
            acc.get("address"),
            acc.get("promo_code"),
            acc.get("signup_ts"),
            ground_truth.get(aid)
        ))

    conn.commit()
    conn.close()


def log_detection_run(threshold: float, metrics: dict, result: dict) -> int:
    """Log a detection run and identified clusters into SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO detection_runs (threshold, precision, recall, f1, total_accounts, num_flagged, num_cleared)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        threshold,
        metrics.get("precision", 0.0),
        metrics.get("recall", 0.0),
        metrics.get("f1", 0.0),
        metrics.get("total_flagged", 0) + metrics.get("tn", 0),
        len(result.get("flagged", [])),
        len(result.get("cleared", []))
    ))

    run_id = cursor.lastrowid

    cursor.execute("DELETE FROM clusters")

    for cluster in result.get("all_clusters", []):
        cursor.execute("""
            INSERT OR REPLACE INTO clusters (cluster_id, run_id, score, group_size, flagged, reasons_json, members_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            cluster["cluster_id"],
            run_id,
            cluster["score"],
            cluster["size"],
            cluster["score"] >= threshold,
            json.dumps(cluster.get("reasons", [])),
            json.dumps(cluster.get("members", []))
        ))

    conn.commit()
    conn.close()
    return run_id
