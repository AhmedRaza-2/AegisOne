"""The administrator-provisioning key must never come from browser configuration."""

import os
from pathlib import Path
import runpy
from unittest.mock import patch

import pytest


CONFIG_PATH = Path(__file__).resolve().parents[1] / "config.py"


@pytest.mark.parametrize(
    ("environment", "expected_key", "from_environment"),
    [
        ({"VITE_SETUP_KEY": "public-browser-test-value"}, None, False),
        ({"SETUP_KEY": "  server-private-test-value  "}, "server-private-test-value", True),
        (
            {"VITE_SETUP_KEY": "public-browser-test-value", "SETUP_KEY": "server-private-test-value"},
            "server-private-test-value",
            True,
        ),
        ({"SETUP_KEY": "aegis-setup-key-change-me"}, None, False),
        ({}, None, False),
    ],
)
def test_setup_key_uses_only_private_server_configuration(environment, expected_key, from_environment):
    # Execute only the lightweight configuration module. Disable dotenv so this test never
    # reads developer credentials, and avoid importing the application, database or models.
    with patch.dict(os.environ, environment, clear=True), patch("dotenv.load_dotenv"):
        config = runpy.run_path(str(CONFIG_PATH))

    assert config["SETUP_KEY"] == expected_key
    assert config["SETUP_KEY_FROM_ENV"] is from_environment
