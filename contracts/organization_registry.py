# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *

ERROR_EXPECTED = "[EXPECTED]"
VALID_WORKSPACES = ("individual", "organization")
VALID_ROLES = ("creator", "admin", "member")


def _required(value, label: str, maximum: int = 160) -> str:
    normalized = str(value).strip()
    if len(normalized) == 0 or len(normalized) > maximum:
        raise gl.vm.UserError(f"{ERROR_EXPECTED} Invalid {label}")
    return normalized


def _wallet(value: str) -> str:
    normalized = _required(value, "wallet", 42).lower()
    if not normalized.startswith("0x") or len(normalized) != 42:
        raise gl.vm.UserError(f"{ERROR_EXPECTED} Invalid wallet")
    return normalized


class OrganizationRegistry(gl.Contract):
    owner: str
    platform_wallet: str
    profiles: TreeMap[str, str]
    organizations: TreeMap[str, str]
    memberships: TreeMap[str, str]
    wallet_organization_ids: TreeMap[str, str]
    wallet_organization_counts: TreeMap[str, u256]
    organization_member_wallets: TreeMap[str, str]
    organization_member_counts: TreeMap[str, u256]
    wallet_nonces: TreeMap[str, u256]
    organization_ids: DynArray[str]
    organization_count: u256

    def __init__(self, platform_wallet: str):
        self.owner = str(gl.message.sender_address).lower()
        self.platform_wallet = _wallet(platform_wallet)
        self.organization_count = u256(0)

    def _only_platform(self) -> None:
        if str(gl.message.sender_address).lower() != self.platform_wallet:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only platform wallet")

    def _consume_nonce(self, wallet: str, nonce: int) -> None:
        expected = self.wallet_nonces.get(wallet, u256(0))
        if int(nonce) != int(expected):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Invalid wallet action nonce")
        self.wallet_nonces[wallet] = expected + u256(1)

    def _membership_key(self, organization_id: str, wallet: str) -> str:
        return organization_id + ":" + wallet

    def _role(self, organization_id: str, wallet: str) -> str:
        raw = self.memberships.get(self._membership_key(organization_id, wallet), "")
        if raw == "":
            return ""
        return str(json.loads(raw).get("role", ""))

    def _require_admin(self, organization_id: str, actor_wallet: str) -> str:
        role = self._role(organization_id, actor_wallet)
        if role not in ("creator", "admin"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Organization admin required")
        return role

    def _append_membership(self, organization_id: str, member_wallet: str) -> None:
        org_count = self.organization_member_counts.get(organization_id, u256(0))
        self.organization_member_wallets[
            organization_id + ":" + str(int(org_count))
        ] = member_wallet
        self.organization_member_counts[organization_id] = org_count + u256(1)

        wallet_count = self.wallet_organization_counts.get(member_wallet, u256(0))
        self.wallet_organization_ids[
            member_wallet + ":" + str(int(wallet_count))
        ] = organization_id
        self.wallet_organization_counts[member_wallet] = wallet_count + u256(1)

    @gl.public.write
    def register_profile(
        self,
        wallet: str,
        default_workspace: str,
        nonce: int,
    ) -> None:
        self._only_platform()
        wallet = _wallet(wallet)
        workspace = _required(default_workspace, "default workspace", 24)
        if workspace not in VALID_WORKSPACES:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Invalid default workspace")
        if self.profiles.get(wallet, "") != "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Wallet profile already exists")
        self._consume_nonce(wallet, nonce)
        self.profiles[wallet] = json.dumps(
            {"wallet": wallet, "default_workspace": workspace, "active": True},
            sort_keys=True,
        )

    @gl.public.write
    def set_default_workspace(
        self,
        wallet: str,
        default_workspace: str,
        nonce: int,
    ) -> None:
        self._only_platform()
        wallet = _wallet(wallet)
        workspace = _required(default_workspace, "default workspace", 24)
        if workspace not in VALID_WORKSPACES:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Invalid default workspace")
        raw = self.profiles.get(wallet, "")
        if raw == "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Wallet profile not found")
        self._consume_nonce(wallet, nonce)
        profile = json.loads(raw)
        profile["default_workspace"] = workspace
        self.profiles[wallet] = json.dumps(profile, sort_keys=True)

    @gl.public.write
    def create_organization(
        self,
        organization_id: str,
        name: str,
        creator_wallet: str,
        nonce: int,
    ) -> None:
        self._only_platform()
        organization_id = _required(organization_id, "organization id", 96)
        creator_wallet = _wallet(creator_wallet)
        if self.profiles.get(creator_wallet, "") == "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Wallet profile not found")
        if self.organizations.get(organization_id, "") != "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Organization already exists")
        self._consume_nonce(creator_wallet, nonce)
        self.organizations[organization_id] = json.dumps(
            {
                "id": organization_id,
                "name": _required(name, "organization name"),
                "creator_wallet": creator_wallet,
                "active": True,
            },
            sort_keys=True,
        )
        self.memberships[self._membership_key(organization_id, creator_wallet)] = (
            json.dumps(
                {
                    "organization_id": organization_id,
                    "wallet": creator_wallet,
                    "role": "creator",
                    "active": True,
                },
                sort_keys=True,
            )
        )
        self._append_membership(organization_id, creator_wallet)
        self.organization_ids.append(organization_id)
        self.organization_count += u256(1)

    @gl.public.write
    def add_member(
        self,
        organization_id: str,
        actor_wallet: str,
        member_wallet: str,
        role: str,
        nonce: int,
    ) -> None:
        self._only_platform()
        organization_id = _required(organization_id, "organization id", 96)
        actor_wallet = _wallet(actor_wallet)
        member_wallet = _wallet(member_wallet)
        role = _required(role, "member role", 16)
        if role not in ("admin", "member"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Invalid assignable role")
        if self.organizations.get(organization_id, "") == "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Organization not found")
        self._require_admin(organization_id, actor_wallet)
        key = self._membership_key(organization_id, member_wallet)
        if self.memberships.get(key, "") != "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Wallet is already a member")
        self._consume_nonce(actor_wallet, nonce)
        self.memberships[key] = json.dumps(
            {
                "organization_id": organization_id,
                "wallet": member_wallet,
                "role": role,
                "active": True,
            },
            sort_keys=True,
        )
        self._append_membership(organization_id, member_wallet)

    @gl.public.write
    def set_member_role(
        self,
        organization_id: str,
        actor_wallet: str,
        member_wallet: str,
        role: str,
        nonce: int,
    ) -> None:
        self._only_platform()
        organization_id = _required(organization_id, "organization id", 96)
        actor_wallet = _wallet(actor_wallet)
        member_wallet = _wallet(member_wallet)
        role = _required(role, "member role", 16)
        if role not in ("admin", "member"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Invalid assignable role")
        self._require_admin(organization_id, actor_wallet)
        key = self._membership_key(organization_id, member_wallet)
        raw = self.memberships.get(key, "")
        if raw == "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Organization member not found")
        record = json.loads(raw)
        if record.get("role") == "creator":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Creator role is immutable")
        self._consume_nonce(actor_wallet, nonce)
        record["role"] = role
        record["active"] = True
        self.memberships[key] = json.dumps(record, sort_keys=True)

    @gl.public.write
    def remove_member(
        self,
        organization_id: str,
        actor_wallet: str,
        member_wallet: str,
        nonce: int,
    ) -> None:
        self._only_platform()
        organization_id = _required(organization_id, "organization id", 96)
        actor_wallet = _wallet(actor_wallet)
        member_wallet = _wallet(member_wallet)
        self._require_admin(organization_id, actor_wallet)
        key = self._membership_key(organization_id, member_wallet)
        raw = self.memberships.get(key, "")
        if raw == "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Organization member not found")
        record = json.loads(raw)
        if record.get("role") == "creator":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Creator cannot be removed")
        self._consume_nonce(actor_wallet, nonce)
        record["active"] = False
        record["role"] = ""
        self.memberships[key] = json.dumps(record, sort_keys=True)

    @gl.public.write
    def set_platform_wallet(self, platform_wallet: str) -> None:
        if str(gl.message.sender_address).lower() != self.owner:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only owner")
        self.platform_wallet = _wallet(platform_wallet)

    @gl.public.view
    def get_profile(self, wallet: str) -> str:
        return self.profiles.get(str(wallet).lower(), "")

    @gl.public.view
    def get_organization(self, organization_id: str) -> str:
        return self.organizations.get(organization_id, "")

    @gl.public.view
    def get_member_role(self, organization_id: str, wallet: str) -> str:
        return self._role(organization_id, str(wallet).lower())

    @gl.public.view
    def get_membership(self, organization_id: str, wallet: str) -> str:
        return self.memberships.get(
            self._membership_key(organization_id, str(wallet).lower()), ""
        )

    @gl.public.view
    def get_wallet_nonce(self, wallet: str) -> u256:
        return self.wallet_nonces.get(str(wallet).lower(), u256(0))

    @gl.public.view
    def get_wallet_organization_count(self, wallet: str) -> u256:
        return self.wallet_organization_counts.get(str(wallet).lower(), u256(0))

    @gl.public.view
    def get_wallet_organization_id_at(self, wallet: str, index: u256) -> str:
        return self.wallet_organization_ids.get(
            str(wallet).lower() + ":" + str(int(index)), ""
        )

    @gl.public.view
    def get_organization_member_count(self, organization_id: str) -> u256:
        return self.organization_member_counts.get(organization_id, u256(0))

    @gl.public.view
    def get_organization_member_wallet_at(
        self, organization_id: str, index: u256
    ) -> str:
        return self.organization_member_wallets.get(
            organization_id + ":" + str(int(index)), ""
        )

    @gl.public.view
    def get_organization_count(self) -> u256:
        return self.organization_count

    @gl.public.view
    def get_organization_id_at(self, index: u256) -> str:
        if index >= self.organization_count:
            return ""
        return self.organization_ids[index]
