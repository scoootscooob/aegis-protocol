"""Tests for the ``@aegis_tool`` LangChain integration decorator."""

from __future__ import annotations

import pytest

from aegis.firewall import AegisFirewall, AegisConfig
from aegis.engines.capital_velocity import CapitalVelocityConfig
from aegis.engines.trajectory_hash import TrajectoryHashConfig
from aegis.integrations.langchain import aegis_tool
from aegis.verdict import VerdictCode


def _make_firewall(**kwargs: object) -> AegisFirewall:
    return AegisFirewall(config=AegisConfig(**kwargs))


# ────────────────────────────────────────────────────────────────────

class TestAegisTool:
    """@aegis_tool decorator for LangChain."""

    def test_allows_clean_call(self) -> None:
        fw = _make_firewall(velocity=CapitalVelocityConfig(v_max=100.0))

        @aegis_tool(fw, spend_key="amount")
        def transfer(payload: dict) -> str:
            return "ok"

        result = transfer({"target": "0xAAA", "amount": 1.0})
        assert result == "ok"

    def test_blocks_velocity_breach(self) -> None:
        fw = _make_firewall(
            velocity=CapitalVelocityConfig(v_max=0.001, max_single_amount=5.0)
        )

        @aegis_tool(fw, spend_key="amount")
        def transfer(payload: dict) -> str:
            return "ok"

        result = transfer({"target": "0xAAA", "amount": 100.0})
        # Should return feedback string, not "ok"
        assert isinstance(result, str)
        assert "ok" != result

    def test_custom_on_block_callback(self) -> None:
        fw = _make_firewall(
            velocity=CapitalVelocityConfig(v_max=0.001, max_single_amount=5.0)
        )

        def my_handler(verdict):
            return f"CUSTOM BLOCK: {verdict.code.value}"

        @aegis_tool(fw, spend_key="amount", on_block=my_handler)
        def transfer(payload: dict) -> str:
            return "ok"

        result = transfer({"target": "0xAAA", "amount": 100.0})
        assert "CUSTOM BLOCK" in result

    def test_dict_args_extraction(self) -> None:
        """Payload extracted from positional dict argument."""
        fw = _make_firewall()
        calls = []

        @aegis_tool(fw, spend_key="amount")
        def transfer(payload: dict) -> str:
            calls.append(payload)
            return "ok"

        result = transfer({"target": "0xAAA", "amount": 1.0})
        assert result == "ok"
        assert len(calls) == 1

    def test_kwargs_extraction(self) -> None:
        """Payload extracted from keyword arguments."""
        fw = _make_firewall()
        calls = []

        @aegis_tool(fw, spend_key="amount")
        def transfer(**kwargs) -> str:
            calls.append(kwargs)
            return "ok"

        result = transfer(target="0xAAA", amount=1.0)
        assert result == "ok"
        assert len(calls) == 1

    def test_exposes_firewall_attribute(self) -> None:
        fw = _make_firewall()

        @aegis_tool(fw)
        def transfer(payload: dict) -> str:
            return "ok"

        assert transfer.aegis_firewall is fw

    def test_preserves_function_name(self) -> None:
        fw = _make_firewall()

        @aegis_tool(fw)
        def my_special_transfer(payload: dict) -> str:
            """Transfer tokens."""
            return "ok"

        assert my_special_transfer.__name__ == "my_special_transfer"
        assert my_special_transfer.__doc__ == "Transfer tokens."
