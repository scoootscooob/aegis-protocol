"""
Aegis Protocol CLI — ``aegis init | up | status``

Entry point registered as ``aegis`` in pyproject.toml ``[project.scripts]``.
Uses only the stdlib (argparse) to keep dependencies at zero.
"""

from __future__ import annotations

import argparse
import sys


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="aegis",
        description="Aegis Protocol CLI \u2014 Circuit breaker for autonomous AI agents",
    )
    subparsers = parser.add_subparsers(dest="command")

    # ── aegis init ─────────────────────────────────────────────────
    subparsers.add_parser(
        "init",
        help="Generate an aegis.toml configuration file interactively",
    )

    # ── aegis up ───────────────────────────────────────────────────
    up_parser = subparsers.add_parser(
        "up",
        help="Start the Dockerized Aegis RPC Proxy",
    )
    up_parser.add_argument(
        "--detach", "-d",
        action="store_true",
        help="Run containers in the background",
    )
    up_parser.add_argument(
        "--compose-file",
        default=None,
        help="Explicit path to docker-compose.yml (auto-detected if omitted)",
    )

    # ── aegis status ───────────────────────────────────────────────
    subparsers.add_parser(
        "status",
        help="Check Aegis RPC Proxy health",
    )

    args = parser.parse_args(argv)

    if args.command == "init":
        from aegis.cli.init_cmd import run_init
        run_init()
    elif args.command == "up":
        from aegis.cli.up_cmd import run_up
        run_up(detach=args.detach, compose_file=args.compose_file)
    elif args.command == "status":
        from aegis.cli.up_cmd import run_status
        run_status()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
