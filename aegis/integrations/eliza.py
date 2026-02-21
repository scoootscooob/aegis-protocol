"""
aegis.integrations.eliza — Aegis wrapper for the Eliza agent framework.

Eliza uses an action-based architecture where ``Action`` classes expose
an ``execute(payload, **kwargs)`` method.  ``AegisElizaAction`` wraps an
inner action and gates execution behind the Aegis firewall.

Usage::

    from aegis.integrations.eliza import AegisElizaAction

    safe_transfer = AegisElizaAction(
        firewall=firewall,
        inner_action=my_transfer_action,
        spend_key="amount",
    )
    result = safe_transfer.execute({"to": "0x...", "amount": 500})
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable, Optional

from aegis.firewall import AegisFirewall
from aegis.verdict import Verdict

logger = logging.getLogger("aegis.integrations.eliza")


@dataclass
class AegisElizaAction:
    """Wraps an Eliza ``Action`` with Aegis enforcement.

    On block, returns a dict with ``aegis_blocked: True`` and the
    cognitive feedback prompt, or delegates to a custom ``on_block``
    callback.
    """

    firewall: AegisFirewall
    inner_action: Any           # Eliza Action class instance
    spend_key: str = "amount"
    on_block: Optional[Callable[[Verdict], Any]] = None

    def execute(self, payload: dict[str, Any], **kwargs: Any) -> Any:
        """Execute the action through Aegis firewall."""
        spend = float(payload.get(self.spend_key, 0))
        verdict = self.firewall.evaluate(payload, spend_amount=spend)

        if verdict.blocked:
            logger.warning(
                "AEGIS BLOCK in Eliza action: %s", verdict.reason,
            )
            if self.on_block is not None:
                return self.on_block(verdict)
            return {
                "aegis_blocked": True,
                "verdict": verdict.code.value,
                "reason": verdict.reason,
                "feedback": verdict.feedback_prompt(),
            }

        return self.inner_action.execute(payload, **kwargs)
