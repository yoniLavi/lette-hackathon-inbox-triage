#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "requests",
#     "python-dotenv",
# ]
# ///
"""Reset and re-seed EspoCRM in one step."""

from reset import main as reset_main
from seed import main as seed_main


def main():
    reset_main()
    print()
    seed_main()


if __name__ == "__main__":
    main()
