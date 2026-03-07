"""Thin wrapper around EspoCRM REST API."""

import os
from pathlib import Path

import requests
from dotenv import load_dotenv


class EspoAPI:
    def __init__(self):
        load_dotenv(Path(__file__).resolve().parent.parent / ".env")
        base = os.environ.get("ESPOCRM_SITE_URL", "http://localhost:8080").rstrip("/")
        self.base_url = f"{base}/api/v1"
        user = os.environ.get("ESPOCRM_ADMIN_USERNAME", "admin")
        password = os.environ.get("ESPOCRM_ADMIN_PASSWORD", "admin123")
        self.session = requests.Session()
        self.session.auth = (user, password)
        self.session.headers.update({"Content-Type": "application/json"})

    def get(self, path, params=None):
        r = self.session.get(f"{self.base_url}/{path}", params=params)
        r.raise_for_status()
        return r.json()

    def post(self, path, data):
        r = self.session.post(f"{self.base_url}/{path}", json=data)
        if not r.ok:
            raise RuntimeError(f"POST {path} {r.status_code}: {r.text}")
        return r.json()

    def delete(self, path):
        r = self.session.delete(f"{self.base_url}/{path}")
        r.raise_for_status()

    def link(self, entity_type, entity_id, link, foreign_id):
        r = self.session.post(
            f"{self.base_url}/{entity_type}/{entity_id}/{link}",
            json={"id": foreign_id},
        )
        r.raise_for_status()
