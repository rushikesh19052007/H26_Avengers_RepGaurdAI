"""Tests for AST Python source usage mapping and JS/TS imports."""

import pytest
from pathlib import Path
import tempfile

from app.services.usage_mapper import (
    extract_python_imports,
    extract_javascript_imports,
    map_usages_in_directory,
    get_usages_for_package,
)


def test_extract_python_imports_ast():
    """Extracts module imports and symbols using Python AST."""
    code = """
import os
import requests
from bs4 import BeautifulSoup
from yaml import safe_load as load_yaml

def run():
    res = requests.get('https://example.com')
    soup = BeautifulSoup(res.text, 'html.parser')
    return soup
"""
    occurrences = extract_python_imports(code, "services/fetcher.py")
    pkg_names = [o.package_name for o in occurrences]

    assert "requests" in pkg_names
    assert "bs4" in pkg_names
    assert "yaml" in pkg_names

    bs4_occ = next(o for o in occurrences if o.package_name == "bs4")
    assert bs4_occ.line_number == 4
    assert bs4_occ.file_path == "services/fetcher.py"
    assert "BeautifulSoup" in bs4_occ.purpose


def test_extract_javascript_imports():
    """Extracts JS/TS imports and requires."""
    code = """
import React, { useState } from 'react';
import axios from 'axios';
const lodash = require('lodash');
import { Button } from '@/components/Button';
"""
    occurrences = extract_javascript_imports(code, "src/components/Header.tsx")
    pkgs = [o.package_name for o in occurrences]

    assert "react" in pkgs
    assert "axios" in pkgs
    assert "lodash" in pkgs
    assert "@/components/Button" not in pkgs  # local relative alias omitted


def test_usage_mapping_with_aliasing():
    """Verifies that PyPI package names (e.g. beautifulsoup4, pyyaml) correctly map to AST imports (bs4, yaml)."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        root = Path(tmp_dir)
        app_file = root / "app.py"
        app_file.write_text(
            "import yaml\nfrom bs4 import BeautifulSoup\nimport requests\n",
            encoding="utf-8",
        )

        usages = map_usages_in_directory(root)

        # beautifulsoup4 -> bs4
        bs4_usages = get_usages_for_package("beautifulsoup4", usages)
        assert len(bs4_usages) == 1
        assert bs4_usages[0].file_path == "app.py"

        # pyyaml -> yaml
        yaml_usages = get_usages_for_package("pyyaml", usages)
        assert len(yaml_usages) == 1
        assert yaml_usages[0].file_path == "app.py"
