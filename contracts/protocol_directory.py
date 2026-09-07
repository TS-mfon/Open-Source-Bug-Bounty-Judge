# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *

ERROR_EXPECTED = "[EXPECTED]"


def _required(value, label: str, maximum: int = 256) -> str:
    normalized = str(value).strip()
    if len(normalized) == 0 or len(normalized) > maximum:
        raise gl.vm.UserError(f"{ERROR_EXPECTED} Invalid {label}")
    return normalized


class ProtocolDirectory(gl.Contract):
    owner: str
    active: TreeMap[str, str]
    versions: TreeMap[str, str]
    updated_at_version: u256

    def __init__(self, owner: str):
        self.owner = str(gl.message.sender_address).lower()
        self.active["registry"] = _required(owner, "registry address", 64)
        self.active["review_protocol"] = ""
        self.versions["registry"] = "v1"
        self.versions["review_protocol"] = ""
        self.updated_at_version = u256(0)

    def _only_owner(self) -> None:
        if str(gl.message.sender_address).lower() != self.owner:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only owner")

    @gl.public.write
    def set_active_contract(
        self, component: str, address: str, version: str
    ) -> None:
        self._only_owner()
        component = _required(component, "component", 64)
        if component not in ("registry", "review_protocol"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Invalid component")
        address = _required(address, "contract address", 64)
        version = _required(version, "contract version", 32)
        self.active[component] = address
        self.versions[component] = version
        self.updated_at_version = self.updated_at_version + u256(1)

    @gl.public.view
    def get_active_contract(self, component: str) -> str:
        return self.active.get(component, "")

    @gl.public.view
    def get_active_version(self, component: str) -> str:
        return self.versions.get(component, "")

    @gl.public.view
    def get_directory_version(self) -> u256:
        return self.updated_at_version
