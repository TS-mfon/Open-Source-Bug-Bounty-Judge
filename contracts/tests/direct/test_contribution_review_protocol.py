import hashlib
import json


HEAD_SHA = "a" * 40
REPOSITORY = "GrantChain/GrantFox"


def candidate(candidate_id="candidate-1", pull_number=123):
    return {
        "id": candidate_id,
        "repository": REPOSITORY,
        "issueNumber": 101,
        "pullRequestNumber": pull_number,
        "headSha": HEAD_SHA,
        "contributor": "builder",
        "contributionType": "code",
        "stellarEvidenceUrls": [],
    }


def sha256(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def candidate_review_key(
    organization_id,
    campaign_id,
    contribution,
    rubric_version,
    review_kind,
):
    return sha256(
        "|".join(
            [
                organization_id,
                campaign_id,
                contribution["repository"].lower(),
                str(contribution["pullRequestNumber"]),
                contribution["headSha"].lower(),
                rubric_version,
                review_kind,
            ]
        )
    )


def campaign_review_key(contributions):
    keys = sorted(
        candidate_review_key(
            "grantfox",
            "campaign-04",
            contribution,
            "code-v1",
            "campaign",
        )
        for contribution in contributions
    )
    return sha256("|".join(["grantfox", "campaign-04", "code-v1"] + keys))


def appeal_review_key(original_review_id, appeal_context):
    return sha256("|".join([original_review_id, "grantfox", appeal_context.strip()]))


def campaign_result(score=90, eligible=True):
    return json.dumps(
        {
            "explanation": "The contribution was compared against the campaign rubric and repository evidence.",
            "candidates": [
                {
                    "id": "candidate-1",
                    "eligible": eligible,
                    "score": score,
                    "confidence_bps": 9000,
                    "summary": "The implementation directly addresses the issue with maintainable code and meaningful tests.",
                    "dimensions": {
                        "correctness": score,
                        "tests": score,
                        "maintainability": score,
                        "scope_alignment": score,
                        "impact": score,
                        "complexity": score,
                    },
                    "strengths": ["Correct implementation", "Relevant tests"],
                    "deficiencies": [],
                    "flags": [],
                    "citations": [
                        f"https://api.github.com/repos/{REPOSITORY}/pulls/123"
                    ],
                }
            ],
        }
    )


def mock_github(direct_vm):
    base = f"https://api.github.com/repos/{REPOSITORY}"
    direct_vm.mock_web(rf"{base}$", {"status": 200, "body": '{"name":"GrantFox"}'})
    direct_vm.mock_web(
        rf"{base}/issues/101$",
        {"status": 200, "body": '{"title":"Implement review API","body":"Acceptance criteria"}'},
    )
    direct_vm.mock_web(
        rf"{base}/pulls/123$",
        {
            "status": 200,
            "body": json.dumps(
                {
                    "head": {"sha": HEAD_SHA},
                    "merged": True,
                    "user": {"login": "builder"},
                }
            ),
        },
    )
    direct_vm.mock_web(
        rf"{base}/pulls/123/files.*",
        {
            "status": 200,
            "body": json.dumps(
                [
                    {
                        "filename": "src/review.ts",
                        "status": "modified",
                        "additions": 40,
                        "deletions": 4,
                        "patch": "@@ implementation and validation @@",
                        "raw_url": "https://raw.githubusercontent.com/GrantChain/GrantFox/"
                        + HEAD_SHA
                        + "/src/review.ts",
                    }
                ]
            ),
        },
    )
    direct_vm.mock_web(
        rf"{base}/pulls/123/reviews.*",
        {"status": 200, "body": '[{"state":"APPROVED"}]'},
    )
    direct_vm.mock_web(
        rf"{base}/pulls/123/commits.*",
        {"status": 200, "body": '[{"sha":"commit"}]'},
    )
    direct_vm.mock_web(
        r"https://raw\.githubusercontent\.com/.*",
        {"status": 200, "body": "export function review() { return true; }"},
    )


def deploy_protocol(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    platform = "0x" + direct_alice.hex()
    return direct_deploy("contracts/contribution_review_protocol.py", platform)


def register_org(contract, scopes=None):
    contract.register_organization_and_api_key(
        "grantfox",
        "GrantFox",
        "0x1111111111111111111111111111111111111111",
        "a" * 64,
        json.dumps(
            scopes
            or [
                "campaigns:write",
                "reviews:create",
                "reviews:read",
                "appeals:create",
                "webhooks:manage",
            ]
        ),
    )


def create_campaign(contract):
    contract.create_campaign(
        "campaign-04",
        "grantfox",
        "external-04",
        "Stellar Builders Sprint",
        "1000000000",
        70,
        "2026-07-01T00:00:00Z",
        "2026-07-20T00:00:00Z",
        "2026-07-21T00:00:00Z",
        "code-v1",
        json.dumps(
            {
                "correctness": 25,
                "tests": 20,
                "maintainability": 15,
                "scope_alignment": 15,
                "impact": 15,
                "complexity": 10,
            }
        ),
        "a" * 64,
        "campaign-create-04",
    )


def test_full_campaign_review_allocates_complete_budget(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract)
    create_campaign(contract)
    contract.add_contributions(
        "campaign-04",
        "grantfox",
        json.dumps([candidate()]),
        "a" * 64,
        "campaign-add-candidates-04",
    )
    mock_github(direct_vm)
    direct_vm.mock_llm(r".*independent open-source contribution reward judge.*", campaign_result())

    review_key = campaign_review_key([candidate()])
    contract.request_campaign_review(
        "review-campaign-04",
        review_key,
        "campaign-04",
        "grantfox",
        "a" * 64,
        "campaign-review-04",
        "",
    )

    stored = json.loads(contract.get_review("review-campaign-04"))
    assert stored["status"] == "finalized"
    assert stored["result"]["qualifying_count"] == 1
    assert stored["result"]["total_allocated_usdc_micros"] == "1000000000"
    assert (
        stored["result"]["candidates"][0]["recommended_usdc_micros"]
        == "1000000000"
    )
    assert contract.get_review_id_by_key(review_key) == "review-campaign-04"


def test_duplicate_pull_request_is_rejected(direct_vm, direct_deploy, direct_alice):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract)
    create_campaign(contract)
    duplicate = candidate("candidate-2")
    with direct_vm.expect_revert("Pull request already registered"):
        contract.add_contributions(
            "campaign-04",
            "grantfox",
            json.dumps([candidate(), duplicate]),
            "a" * 64,
            "campaign-add-duplicate",
        )


def test_duplicate_review_key_is_rejected(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract)
    create_campaign(contract)
    contract.add_contributions(
        "campaign-04",
        "grantfox",
        json.dumps([candidate()]),
        "a" * 64,
        "campaign-add-candidates-04",
    )
    mock_github(direct_vm)
    direct_vm.mock_llm(r".*independent open-source contribution reward judge.*", campaign_result())
    review_key = campaign_review_key([candidate()])
    contract.request_campaign_review(
        "review-campaign-04",
        review_key,
        "campaign-04",
        "grantfox",
        "a" * 64,
        "campaign-review-04",
        "",
    )
    with direct_vm.expect_revert("already reviewed"):
        contract.request_campaign_review(
            "review-campaign-04-retry",
            review_key,
            "campaign-04",
            "grantfox",
            "a" * 64,
            "campaign-review-04-retry",
            "",
        )


def test_below_threshold_goes_to_admin_review(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract)
    create_campaign(contract)
    contract.add_contributions(
        "campaign-04",
        "grantfox",
        json.dumps([candidate()]),
        "a" * 64,
        "campaign-add-candidates-04",
    )
    mock_github(direct_vm)
    direct_vm.mock_llm(
        r".*independent open-source contribution reward judge.*",
        campaign_result(score=65),
    )
    contract.request_campaign_review(
        "review-below",
        campaign_review_key([candidate()]),
        "campaign-04",
        "grantfox",
        "a" * 64,
        "campaign-review-below",
        "",
    )
    stored = json.loads(contract.get_review("review-below"))
    assert stored["status"] == "admin_review"
    assert stored["result"]["total_allocated_usdc_micros"] == "0"
    assert stored["result"]["shortlist"] == ["candidate-1"]


def test_non_platform_cannot_create_campaign(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only platform wallet"):
        contract.create_campaign(
            "campaign-04",
            "grantfox",
            "external-04",
            "Stellar Builders Sprint",
            "1000000000",
            70,
            "2026-07-01T00:00:00Z",
            "2026-07-20T00:00:00Z",
            "2026-07-21T00:00:00Z",
            "code-v1",
            "{}",
            "a" * 64,
            "campaign-create-04",
        )


def test_contract_rejects_platform_supplied_fake_review_key(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract)
    create_campaign(contract)
    contract.add_contributions(
        "campaign-04",
        "grantfox",
        json.dumps([candidate()]),
        "a" * 64,
        "campaign-add-candidates-04",
    )
    with direct_vm.expect_revert("Invalid campaign review key"):
        contract.request_campaign_review(
            "review-fake-key",
            "f" * 64,
            "campaign-04",
            "grantfox",
            "a" * 64,
            "campaign-review-fake-key",
            "",
        )


def test_contract_rejects_invalid_rubric(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract)
    with direct_vm.expect_revert("Rubric weights must total 100"):
        contract.create_campaign(
            "invalid-rubric",
            "grantfox",
            "external-invalid",
            "Invalid Rubric",
            "1000000",
            70,
            "2027-07-01T00:00:00Z",
            "2027-07-20T00:00:00Z",
            "2027-07-21T00:00:00Z",
            "code-v1",
            json.dumps({"correctness": 40, "tests": 40}),
            "a" * 64,
            "invalid-rubric-create",
        )


def test_api_key_scope_is_enforced_on_chain(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract, ["reviews:read"])
    with direct_vm.expect_revert("API key scope missing"):
        create_campaign(contract)


def test_appeal_creates_revision_without_overwriting_original(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract)
    create_campaign(contract)
    contribution = candidate()
    contract.add_contributions(
        "campaign-04",
        "grantfox",
        json.dumps([contribution]),
        "a" * 64,
        "campaign-add-candidates-04",
    )
    mock_github(direct_vm)
    direct_vm.mock_llm(r".*independent open-source contribution reward judge.*", campaign_result())
    original_key = campaign_review_key([contribution])
    contract.request_campaign_review(
        "review-original",
        original_key,
        "campaign-04",
        "grantfox",
        "a" * 64,
        "campaign-review-original",
        "",
    )
    original_before = contract.get_review("review-original")
    appeal_context = (
        "Re-evaluate the same immutable revision with the clarified acceptance criteria."
    )
    contract.request_campaign_appeal(
        "review-appeal",
        appeal_review_key("review-original", appeal_context),
        "review-original",
        "grantfox",
        "a" * 64,
        "campaign-review-appeal",
        appeal_context,
    )
    appealed = json.loads(contract.get_review("review-appeal"))
    assert contract.get_review("review-original") == original_before
    assert appealed["supersedes_review_id"] == "review-original"
    assert json.loads(contract.get_campaign("campaign-04"))["latest_review_id"] == "review-appeal"


def test_idempotency_keys_are_namespaced_by_organization(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract)
    contract.register_organization_and_api_key(
        "second-org",
        "Second Organization",
        "0x2222222222222222222222222222222222222222",
        "b" * 64,
        json.dumps(["campaigns:write"]),
    )
    create_campaign(contract)
    contract.create_campaign(
        "second-campaign",
        "second-org",
        "external-second",
        "Second Campaign",
        "2000000",
        70,
        "2027-08-01T00:00:00Z",
        "2027-08-20T00:00:00Z",
        "2027-08-21T00:00:00Z",
        "code-v1",
        json.dumps(
            {
                "correctness": 25,
                "tests": 20,
                "maintainability": 15,
                "scope_alignment": 15,
                "impact": 15,
                "complexity": 10,
            }
        ),
        "b" * 64,
        "campaign-create-04",
    )
    assert json.loads(contract.get_campaign("second-campaign"))["organization_id"] == "second-org"


def test_webhook_configuration_and_delivery_marks_require_authorized_callers(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract)
    contract.set_webhook_endpoint(
        "grantfox",
        "https://example.com/osj-webhooks",
        "a" * 64,
    )
    assert contract.get_webhook_endpoint("grantfox") == "https://example.com/osj-webhooks"
    contract.mark_webhook_delivered("delivery-1")
    assert contract.is_webhook_delivered("delivery-1") is True
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only platform wallet"):
        contract.mark_webhook_delivered("delivery-2")
