import hashlib
import json


HEAD_SHA = "a" * 40
REPOSITORY = "GrantChain/GrantFox"


def candidate(candidate_id="candidate-1", pull_number=123, head_sha=HEAD_SHA):
    return {
        "id": candidate_id,
        "repository": REPOSITORY,
        "issueNumber": 101,
        "pullRequestNumber": pull_number,
        "headSha": head_sha,
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


def campaign_review_key(
    contributions,
    organization_id="grantfox",
    campaign_id="campaign-04",
    rubric_version="code-v1",
):
    keys = sorted(
        candidate_review_key(
            organization_id,
            campaign_id,
            contribution,
            rubric_version,
            "campaign",
        )
        for contribution in contributions
    )
    return sha256(
        "|".join([organization_id, campaign_id, rubric_version] + keys)
    )


def appeal_review_key(original_review_id, appeal_context):
    return sha256("|".join([original_review_id, "grantfox", appeal_context.strip()]))


def campaign_result(
    score=90,
    eligible=True,
    candidate_id="candidate-1",
    head_sha=HEAD_SHA,
    flags=None,
):
    return json.dumps(
        {
            "explanation": "The contribution was compared against the campaign rubric and repository evidence.",
            "candidates": [
                {
                    "id": candidate_id,
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
                    "flags": flags or [],
                    "citations": [
                        "https://raw.githubusercontent.com/GrantChain/GrantFox/"
                        + head_sha
                        + "/src/review.ts"
                    ],
                }
            ],
        }
    )


def mock_github(
    direct_vm,
    pull_number=123,
    issue_number=101,
    head_sha=HEAD_SHA,
    patch_body=None,
):
    base = f"https://github.com/{REPOSITORY}"
    direct_vm.mock_web(rf"{base}$", {"status": 200, "body": "<html>GrantFox repository</html>"})
    direct_vm.mock_web(
        rf"{base}/issues/{issue_number}$",
        {"status": 200, "body": "<html>Implement review API. Acceptance criteria.</html>"},
    )
    direct_vm.mock_web(
        rf"{base}/pull/{pull_number}$",
        {
            "status": 200,
            "body": f"<html>Pull request by builder at {head_sha}</html>",
        },
    )
    direct_vm.mock_web(
        rf"{base}/pull/{pull_number}\.patch$",
        {
            "status": 200,
            "body": patch_body or (
                f"From {head_sha} Mon Sep 17 00:00:00 2001\n"
                "Subject: [PATCH] Implement review API\n\n"
                "diff --git a/src/review.ts b/src/review.ts\n"
                "--- a/src/review.ts\n"
                "+++ b/src/review.ts\n"
                "@@ -1 +1 @@\n"
                "-export const review = false;\n"
                "+export function review() { return true; }\n"
            ),
        },
    )
    direct_vm.mock_web(
        r"https://raw\.githubusercontent\.com/.*",
        {"status": 200, "body": "export function review() { return true; }"},
    )


def test_review_rejects_submitted_sha_that_differs_from_patch_head(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract)
    create_campaign(contract)
    stale = candidate(head_sha="b" * 40)
    contract.add_contributions(
        "campaign-04", "grantfox", json.dumps([stale]), "a" * 64, "add-sha-mismatch"
    )
    mock_github(direct_vm, 123, 101, HEAD_SHA)
    with direct_vm.expect_revert("Submitted head SHA does not match PR patch head"):
        contract.request_campaign_review(
            "review-sha-mismatch",
            campaign_review_key([stale]),
            "campaign-04",
            "grantfox",
            "a" * 64,
            "review-sha-mismatch-key",
            "",
        )


def test_review_rejects_truncated_pull_request_patch(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract)
    create_campaign(contract)
    large_patch = f"From {HEAD_SHA} Mon Sep 17 00:00:00 2001\n" + ("x" * 15000)
    contract.add_contributions(
        "campaign-04", "grantfox", json.dumps([candidate()]), "a" * 64, "add-large-patch"
    )
    mock_github(direct_vm, patch_body=large_patch)
    with direct_vm.expect_revert("Pull request patch is too large"):
        contract.request_campaign_review(
            "review-large-patch",
            campaign_review_key([candidate()]),
            "campaign-04",
            "grantfox",
            "a" * 64,
            "review-large-patch-key",
            "",
        )


def test_review_uses_pr_patch_and_links_without_github_json_api(
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
        "campaign-add-stale-candidate",
    )
    mock_github(direct_vm)
    direct_vm.mock_llm(
        r".*independent open-source contribution reward judge.*",
        campaign_result(score=90),
    )

    review_key = campaign_review_key([candidate()])
    contract.request_campaign_review(
        "review-resolved-head",
        review_key,
        "campaign-04",
        "grantfox",
        "a" * 64,
        "campaign-review-resolved-head",
        "",
    )

    stored = json.loads(contract.get_review("review-resolved-head"))
    assert stored["status"] == "finalized"
    assert stored["result"]["candidates"][0]["recommended_usdc_micros"] == "40000000"


def test_campaign_review_rejects_more_than_one_pull_request(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract)
    create_campaign(contract)
    first = candidate("candidate-1", 123)
    second = candidate("candidate-2", 124)
    second["issueNumber"] = 102
    contract.add_contributions(
        "campaign-04",
        "grantfox",
        json.dumps([first]),
        "a" * 64,
        "campaign-add-one-candidate",
    )
    with direct_vm.expect_revert("Exactly one pull request is allowed per review"):
        contract.request_batch_review(
            "review-two-candidates",
            campaign_review_key([first, second]),
            json.dumps([first, second]),
            "a" * 64,
            "campaign-review-two-candidates",
            "",
        )


def deploy_protocol(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    platform = "0x" + direct_alice.hex()
    return direct_deploy(
        "contracts/contribution_review_protocol.py",
        platform,
        platform,
    )


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
        "10000000000",
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


def create_batch_campaign_state(contract, budget="5000000000"):
    campaign = {
        "id": "campaign-04",
        "organization_id": "grantfox",
        "name": "Dashboard Campaign",
        "budget_usdc_micros": budget,
        "spent_usdc_micros": "0",
        "quality_threshold": 70,
        "rubric_version": "code-v1",
        "rubric": {
            "correctness": 25,
            "tests": 20,
            "maintainability": 15,
            "scope_alignment": 15,
            "impact": 15,
            "complexity": 10,
        },
        "status": "active",
        "active_api_key_hash": "b" * 64,
        "created_by": "0x1111111111111111111111111111111111111111",
        "latest_review_id": "",
    }
    contract.campaigns["campaign-04"] = json.dumps(campaign, sort_keys=True)
    contract.api_keys["b" * 64] = json.dumps(
        {
            "organization_id": "grantfox",
            "campaign_id": "campaign-04",
            "scopes": ["reviews:create", "reviews:read", "appeals:create"],
            "active": True,
            "usage_count": 0,
            "max_requests": 10000,
        },
        sort_keys=True,
    )


def test_campaign_review_caps_single_reward_at_sixty_usdc(
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
        campaign_result(score=100),
    )

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
    assert stored["result"]["total_allocated_usdc_micros"] == "60000000"
    assert stored["result"]["unallocated_budget_usdc_micros"] == "9940000000"
    assert stored["result"]["paid_count"] == 1
    assert (
        stored["result"]["candidates"][0]["recommended_usdc_micros"]
        == "60000000"
    )
    campaign = json.loads(contract.get_campaign("campaign-04"))
    assert campaign["spent_usdc_micros"] == "60000000"
    assert contract.get_review_id_by_key(review_key) == "review-campaign-04"


def test_batch_reviews_consume_campaign_budget_cumulatively(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    create_batch_campaign_state(contract)
    first = candidate("candidate-1", 123, HEAD_SHA)
    second_sha = "b" * 40
    second = candidate("candidate-2", 124, second_sha)
    mock_github(direct_vm, 123, 101, HEAD_SHA)
    mock_github(direct_vm, 124, 101, second_sha)
    direct_vm.mock_llm(
        r".*independent open-source contribution reward judge.*",
        campaign_result(score=100, candidate_id="candidate-1"),
    )

    contract.request_batch_review(
        "review-batch-1",
        campaign_review_key([first]),
        json.dumps([first]),
        "b" * 64,
        "batch-review-1",
        "",
    )

    direct_vm.clear_mocks()
    mock_github(direct_vm, 124, 101, second_sha)
    direct_vm.mock_llm(
        r".*independent open-source contribution reward judge.*",
        campaign_result(
            score=100,
            candidate_id="candidate-2",
            head_sha=second_sha,
        ),
    )
    contract.request_batch_review(
        "review-batch-2",
        campaign_review_key([second]),
        json.dumps([second]),
        "b" * 64,
        "batch-review-2",
        "",
    )

    first_review = json.loads(contract.get_review("review-batch-1"))
    second_review = json.loads(contract.get_review("review-batch-2"))
    campaign = json.loads(contract.get_campaign("campaign-04"))
    assert first_review["result"]["total_allocated_usdc_micros"] == "60000000"
    assert first_review["result"]["unallocated_budget_usdc_micros"] == "4940000000"
    assert second_review["result"]["total_allocated_usdc_micros"] == "60000000"
    assert second_review["result"]["unallocated_budget_usdc_micros"] == "4880000000"
    assert campaign["spent_usdc_micros"] == "120000000"


def test_campaign_budget_must_be_at_least_five_thousand_usdc(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    register_org(contract)
    with direct_vm.expect_revert("Campaign budget must be at least 5000 USDC"):
        contract.create_campaign(
            "underfunded",
            "grantfox",
            "external-underfunded",
            "Underfunded Campaign",
            "4999999999",
            70,
            "2027-07-01T00:00:00Z",
            "2027-07-20T00:00:00Z",
            "2027-07-21T00:00:00Z",
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
            "underfunded-create",
        )


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
    direct_vm.mock_llm(
        r".*independent open-source contribution reward judge.*",
        campaign_result(score=100),
    )
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
            "5000000000",
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
    direct_vm.clear_mocks()
    mock_github(direct_vm)
    direct_vm.mock_llm(
        r".*independent open-source contribution reward judge.*",
        campaign_result(score=75),
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
    campaign = json.loads(contract.get_campaign("campaign-04"))
    assert contract.get_review("review-original") == original_before
    assert appealed["supersedes_review_id"] == "review-original"
    assert appealed["result"]["total_allocated_usdc_micros"] == "20000000"
    assert campaign["spent_usdc_micros"] == "20000000"
    assert campaign["latest_review_id"] == "review-appeal"

    second_context = (
        "Try to supersede the same original review again with different context."
    )
    with direct_vm.expect_revert("Review already superseded"):
        contract.request_campaign_appeal(
            "review-appeal-duplicate",
            appeal_review_key("review-original", second_context),
            "review-original",
            "grantfox",
            "a" * 64,
            "campaign-review-appeal-duplicate",
            second_context,
        )


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
        "5000000000",
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


def test_single_review_exposes_wallet_count_and_index(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    contribution = candidate()
    requester = "0x1111111111111111111111111111111111111111"
    review_key = candidate_review_key(
        requester,
        "individual",
        contribution,
        "code-v1",
        "single",
    )
    mock_github(direct_vm)
    direct_vm.mock_llm(
        r".*independent open-source contribution reward judge.*",
        campaign_result(),
    )

    contract.request_single_review(
        "review-single",
        review_key,
        requester,
        json.dumps(contribution),
    )

    assert int(contract.get_wallet_review_count(requester.upper())) == 1
    assert contract.get_wallet_review_id_at(requester, 0) == "review-single"
