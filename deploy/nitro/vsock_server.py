"""
Aegis Nitro Enclave — vsock signing server.

Runs inside an AWS Nitro Enclave.  Receives transaction signing
requests via vsock (the only permitted I/O channel), runs the full
7-engine Aegis chain, and returns only the signature.

The private key NEVER leaves the enclave.

Protocol (JSON over vsock):
  → {"action": "sign_eth", "key_id": "...", "tx_dict": {...}}
  ← {"ok": true, "signature": "0x..."} | {"ok": false, "error": "..."}
"""

from __future__ import annotations

import json
import logging
import socket
import sys
from typing import Any

# These imports work because the Dockerfile copies the aegis/ package
from aegis.firewall import AegisFirewall, AegisConfig
from aegis.enclave.vault import KeyVault, AegisEnforcementError

logger = logging.getLogger("aegis.nitro")

# Vsock constants (AWS Nitro)
VSOCK_PORT = 5000
AF_VSOCK = 40  # socket.AF_VSOCK on Linux with vsock support


def handle_request(
    vault: KeyVault,
    data: dict[str, Any],
) -> dict[str, Any]:
    """Process a single signing request."""
    action = data.get("action", "")

    if action == "store_key":
        key_id = data["key_id"]
        secret = data["secret"]
        vault.store(key_id, secret)
        return {"ok": True, "key_id": key_id}

    elif action == "sign_eth":
        key_id = data["key_id"]
        tx_dict = data["tx_dict"]
        spend = float(data.get("spend_amount", 0))
        try:
            signature = vault.sign_eth_transaction(key_id, tx_dict, spend_amount=spend)
            return {"ok": True, "signature": signature}
        except AegisEnforcementError as e:
            return {"ok": False, "error": str(e), "blocked": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    elif action == "sign_typed":
        key_id = data["key_id"]
        typed_data = data["typed_data"]
        try:
            signature = vault.sign_typed_data(key_id, typed_data)
            return {"ok": True, "signature": signature}
        except AegisEnforcementError as e:
            return {"ok": False, "error": str(e), "blocked": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    elif action == "health":
        return {
            "ok": True,
            "status": "enclave_running",
            "keys": len(vault.list_key_ids()),
        }

    else:
        return {"ok": False, "error": f"Unknown action: {action}"}


def main() -> None:
    """Start the vsock server."""
    logging.basicConfig(level=logging.INFO)
    logger.info("Aegis Nitro Enclave starting on vsock port %d", VSOCK_PORT)

    # Initialize vault with firewall
    config = AegisConfig()
    firewall = AegisFirewall(config=config)
    vault = firewall.vault

    logger.info("Firewall + vault initialized (7 engines active)")

    try:
        # Try real vsock first (only works inside Nitro Enclave)
        sock = socket.socket(AF_VSOCK, socket.SOCK_STREAM)
        sock.bind((socket.VMADDR_CID_ANY, VSOCK_PORT))
    except (AttributeError, OSError):
        # Fallback to TCP for local development/testing
        logger.warning("vsock not available — falling back to TCP :5000")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("127.0.0.1", VSOCK_PORT))

    sock.listen(5)
    logger.info("Listening for signing requests...")

    while True:
        conn, addr = sock.accept()
        logger.info("Connection from %s", addr)

        try:
            raw = conn.recv(65536)
            if not raw:
                continue

            request = json.loads(raw.decode("utf-8"))
            response = handle_request(vault, request)

            conn.sendall(json.dumps(response).encode("utf-8"))
        except Exception as exc:
            logger.error("Error processing request: %s", exc)
            error_resp = json.dumps({"ok": False, "error": str(exc)})
            conn.sendall(error_resp.encode("utf-8"))
        finally:
            conn.close()


if __name__ == "__main__":
    main()
