from __future__ import annotations

import pytest

import kleinkram.errors
from kleinkram.core import _validate_docker_namespace


@pytest.mark.parametrize(
    ("namespace", "image"),
    [
        (None, "any.registry.io/x"),
        ("", "any.registry.io/x"),
        ("rslethz", "rslethz/x"),
        ("rslethz", "rslethz/x:1.0"),
        ("rslethz/", "rslethz/x"),
        (" rslethz ", "rslethz/x"),
        ("my-org_1", "my-org_1/x"),
    ],
)
def test_docker_namespace_allowed(monkeypatch, namespace, image):
    if namespace is None:
        monkeypatch.delenv("VITE_DOCKER_HUB_NAMESPACE", raising=False)
    else:
        monkeypatch.setenv("VITE_DOCKER_HUB_NAMESPACE", namespace)
    _validate_docker_namespace(image)


@pytest.mark.parametrize(
    ("namespace", "image"),
    [
        ("rslethz", "rslethzevil/x"),
        ("rslethz", "rslethz.evil.io/x"),
        ("rslethz", "rslethz"),
        ("rslethz", "evil.io/rslethz/x"),
        ("evil.io/org", "evil.io/org/x"),
        ("evil.io", "evil.io/x"),
        ("host:5000", "host:5000/x"),
        ("localhost", "localhost/x"),
    ],
)
def test_docker_namespace_rejected(monkeypatch, namespace, image):
    monkeypatch.setenv("VITE_DOCKER_HUB_NAMESPACE", namespace)
    with pytest.raises(kleinkram.errors.TemplateValidationError):
        _validate_docker_namespace(image)
