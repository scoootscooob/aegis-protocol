"""
Aegis Protocol — Deterministic Circuit Breaker for Autonomous AI Agents.

The financial seatbelt for the machine economy.
"""

from aegis.firewall import AegisFirewall, AegisConfig
from aegis.decorator import with_aegis_firewall
from aegis.verdict import Verdict, VerdictCode
from aegis.engines.threat_feed import ThreatFeedEngine, ThreatFeedConfig
from aegis.enclave.vault import KeyVault, AegisEnforcementError
from aegis.escrow import EscrowQueue, EscrowConfig, EscrowedTransaction, EscrowStatus, IntentClassifier
from aegis.enclave.tee import TEEEnclave, TEEConfig, TEEBackend, SoftwareBackend, AttestationReport
from aegis.intent import NormalizedIntent, IntentProtocol, IntentAction

__all__ = [
    "AegisFirewall",
    "AegisConfig",
    "with_aegis_firewall",
    "Verdict",
    "VerdictCode",
    "ThreatFeedEngine",
    "ThreatFeedConfig",
    "KeyVault",
    "AegisEnforcementError",
    "EscrowQueue",
    "EscrowConfig",
    "EscrowedTransaction",
    "EscrowStatus",
    "IntentClassifier",
    "TEEEnclave",
    "TEEConfig",
    "TEEBackend",
    "SoftwareBackend",
    "AttestationReport",
    "NormalizedIntent",
    "IntentProtocol",
    "IntentAction",
]

__version__ = "2.0.0"
